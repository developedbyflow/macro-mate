using System.Globalization;
using System.Text;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Foods;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Ai;

public sealed record FoodEnrichRequest(string? Name, string? Brand, NutritionValues Values, string? LabelImageDataUrl);

public sealed record FoodEnrichResponse(
    string Name,
    double Kcal,
    double ProteinG,
    double CarbsG,
    double FatG,
    double FiberG,
    double SodiumMg,
    List<string> EstimatedFields,
    string Category,
    string InsulinGrade,
    int WeightLossScore,
    string Reason);

public sealed record AiStatus(bool Configured);

public sealed record MacroBudget(double Kcal, double ProteinG, double CarbsG, double FatG);

public sealed record RecipeGenerateRequest(string Prompt, double? MaxKcalPerServing, MacroBudget? Remaining);

public sealed record DraftIngredient(Guid FoodId, double Grams);

public sealed record MissingIngredient(string Name, double Grams);

public sealed record RecipeDraft(
    string Name,
    string Instructions,
    int PrepTimeMin,
    string Difficulty,
    int Servings,
    List<DraftIngredient> Ingredients,
    List<MissingIngredient> Missing);

public static class AiEndpoints
{
    public static void MapAiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai").RequireAuthorization();
        group.MapGet("/status", (DeepSeekClient ai) => new AiStatus(ai.IsConfigured));
        group.MapPost("/foods/enrich", EnrichFood).Produces<FoodEnrichResponse>();
        group.MapPost("/recipes/generate", GenerateRecipe).Produces<RecipeDraft>();
    }

    sealed record EnrichAnswer(
        string? Name,
        double? Kcal,
        double? ProteinG,
        double? CarbsG,
        double? FatG,
        double? FiberG,
        double? SodiumMg,
        List<string>? FromLabel,
        string? Category,
        string? InsulinGrade,
        double? WeightLossScore,
        string? Reason);

    static async Task<IResult> EnrichFood(FoodEnrichRequest request, DeepSeekClient ai, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) && request.LabelImageDataUrl is null)
            return Results.Problem("Dă un nume sau o poză la etichetă.", statusCode: StatusCodes.Status400BadRequest);
        if (request.LabelImageDataUrl is { } image && (!image.StartsWith("data:image/") || image.Length > 8_000_000))
            return Results.Problem("Poza trebuie să fie o imagine mai mică de 6 MB.", statusCode: StatusCodes.Status400BadRequest);

        var v = request.Values;
        var known = new StringBuilder()
            .AppendLine($"Name: {request.Name ?? "(unknown, read it from the label)"}")
            .AppendLine($"Brand: {request.Brand ?? "(unknown)"}")
            .AppendLine("Known values per 100 g (null = missing):")
            .AppendLine($"kcal={Show(v.Kcal)}, proteinG={Show(v.ProteinG)}, carbsG={Show(v.CarbsG)}, fatG={Show(v.FatG)}, fiberG={Show(v.FiberG)}, sodiumMg={Show(v.SodiumMg)}")
            .AppendLine(request.LabelImageDataUrl is null ? "No label photo." : "The nutrition label photo is attached.")
            .ToString();

        return await Guard(async () =>
        {
            var answer = await ai.AskJsonAsync<EnrichAnswer>(AiPrompts.FoodEnrich, known, request.LabelImageDataUrl, ct);
            var fromLabel = answer.FromLabel ?? [];

            var estimated = new List<string>();
            double Pick(string field, double? givenValue, double? aiValue, double max)
            {
                if (givenValue is { } given)
                    return given;
                if (!fromLabel.Contains(field))
                    estimated.Add(field);
                return Math.Round(Math.Clamp(aiValue ?? 0, 0, max), 1);
            }

            var response = new FoodEnrichResponse(
                Name: string.IsNullOrWhiteSpace(request.Name) ? answer.Name?.Trim() ?? "" : request.Name.Trim(),
                Kcal: Pick("kcal", v.Kcal, answer.Kcal, 900),
                ProteinG: Pick("proteinG", v.ProteinG, answer.ProteinG, 100),
                CarbsG: Pick("carbsG", v.CarbsG, answer.CarbsG, 100),
                FatG: Pick("fatG", v.FatG, answer.FatG, 100),
                FiberG: Pick("fiberG", v.FiberG, answer.FiberG, 100),
                SodiumMg: Pick("sodiumMg", v.SodiumMg, answer.SodiumMg, 40000),
                EstimatedFields: estimated,
                Category: answer.Category is { } c && FoodCategories.IsValid(c) ? c : "",
                InsulinGrade: answer.InsulinGrade is "A" or "B" or "C" ? answer.InsulinGrade : "B",
                WeightLossScore: (int)Math.Clamp(Math.Round(answer.WeightLossScore ?? 5), 1, 10),
                Reason: answer.Reason?.Trim() ?? "");

            return Results.Ok(response);
        });
    }

    sealed record GenerateAnswer(
        string? Name,
        string? Instructions,
        double? PrepTimeMin,
        string? Difficulty,
        double? Servings,
        List<GenerateIngredient>? Ingredients,
        List<GenerateMissing>? Missing);

    sealed record GenerateIngredient(int Food, double Grams);

    sealed record GenerateMissing(string Name, double Grams);

    static async Task<IResult> GenerateRecipe(
        RecipeGenerateRequest request,
        DeepSeekClient ai,
        AppDbContext db,
        CurrentUser me,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt) || request.Prompt.Length > 500)
            return Results.Problem("Scrie ce ai poftă, în maxim 500 de caractere.", statusCode: StatusCodes.Status400BadRequest);

        var profile = await db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == me.Id, ct);
        var excludedFoods = profile?.ExcludedFoodIds.ToHashSet() ?? [];
        var excludedCategories = profile?.ExcludedCategories.ToHashSet() ?? [];
        var liked = profile?.LikedFoodIds.ToHashSet() ?? [];

        var foods = await db.Foods.AsNoTracking()
            .Where(f => f.DeletedAt == null)
            .OrderBy(f => f.Category).ThenBy(f => f.Name)
            .ToListAsync(ct);
        foods = foods.Where(f => !excludedFoods.Contains(f.Id) && !excludedCategories.Contains(f.Category)).ToList();
        if (foods.Count == 0)
            return Results.Problem("Nu sunt alimente în bază din care să fac o rețetă.", statusCode: StatusCodes.Status400BadRequest);

        var list = new StringBuilder("index|name|category|kcal|proteinG|carbsG|fatG|fiberG|liked\n");
        for (var i = 0; i < foods.Count; i++)
        {
            var f = foods[i];
            var name = f.Brand is null ? f.Name : $"{f.Name} ({f.Brand})";
            list.AppendLine(string.Join('|', i, name, f.Category, Show(f.Kcal), Show(f.ProteinG), Show(f.CarbsG), Show(f.FatG), Show(f.FiberG), liked.Contains(f.Id) ? "liked" : ""));
        }

        var budget = request.MaxKcalPerServing is { } max
            ? $"At most {Show(max)} kcal per serving."
            : request.Remaining is { } r
                ? $"What the user still has today: {Show(r.Kcal)} kcal, {Show(r.ProteinG)} g protein, {Show(r.CarbsG)} g carbohydrates, {Show(r.FatG)} g fat. One serving must fit inside it."
                : "No strict budget; keep one serving reasonable (300-700 kcal).";

        var userMessage = $"Craving: {request.Prompt.Trim()}\nBudget: {budget}\n\nFoods:\n{list}";

        return await Guard(async () =>
        {
            var answer = await ai.AskJsonAsync<GenerateAnswer>(AiPrompts.RecipeGenerate, userMessage, null, ct);
            var ingredients = (answer.Ingredients ?? [])
                .Where(i => i.Food >= 0 && i.Food < foods.Count && i.Grams > 0)
                .GroupBy(i => i.Food)
                .Select(g => new DraftIngredient(foods[g.Key].Id, Math.Round(g.Sum(i => i.Grams))))
                .ToList();
            if (ingredients.Count == 0)
                throw new AiFailedException("DeepSeek n-a folosit niciun aliment din bază.");

            var draft = new RecipeDraft(
                Name: answer.Name?.Trim() is { Length: > 0 } n ? n : "Rețetă nouă",
                Instructions: answer.Instructions?.Trim() ?? "",
                PrepTimeMin: (int)Math.Clamp(Math.Round(answer.PrepTimeMin ?? 20), 1, 1440),
                Difficulty: answer.Difficulty is "easy" or "medium" or "hard" ? answer.Difficulty : "easy",
                Servings: (int)Math.Clamp(Math.Round(answer.Servings ?? 1), 1, 20),
                Ingredients: ingredients,
                Missing: (answer.Missing ?? []).Where(m => !string.IsNullOrWhiteSpace(m.Name)).Select(m => new MissingIngredient(m.Name.Trim(), Math.Round(m.Grams))).ToList());

            return Results.Ok(draft);
        });
    }

    static async Task<IResult> Guard(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (AiNotConfiguredException)
        {
            return Results.Problem("AI-ul nu e configurat: lipsește cheia DeepSeek pe server.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (AiFailedException e)
        {
            return Results.Problem(e.Message, statusCode: StatusCodes.Status502BadGateway);
        }
        catch (HttpRequestException)
        {
            return Results.Problem("Nu am putut ajunge la DeepSeek.", statusCode: StatusCodes.Status502BadGateway);
        }
    }

    static string Show(double? value) => value?.ToString("0.#", CultureInfo.InvariantCulture) ?? "null";
}

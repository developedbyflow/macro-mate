using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Admin;

public static class SeedFoods
{
    sealed record SeedFood(
        string Name,
        string Category,
        double Kcal,
        double ProteinG,
        double CarbsG,
        double FatG,
        double FiberG,
        double SodiumMg,
        double? UnitWeightG,
        string GlycemicGrade,
        string WeightLossGrade,
        string Reason);

    public static async Task<int> RunAsync(AppDbContext db, Guid createdBy, CancellationToken ct)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Seed", "foods.json");
        var seeds = JsonSerializer.Deserialize<List<SeedFood>>(await File.ReadAllTextAsync(path, ct), JsonSerializerOptions.Web) ?? [];

        var ids = seeds.Select(s => IdFor(s.Name)).ToList();
        var existing = await db.Foods.Where(f => ids.Contains(f.Id)).Select(f => f.Id).ToListAsync(ct);
        var missing = seeds.Where(s => !existing.Contains(IdFor(s.Name))).ToList();
        if (missing.Count == 0)
            return 0;

        await SyncWriter.WriteAsync(db, (version, now) =>
        {
            foreach (var s in missing)
            {
                db.Foods.Add(new Food
                {
                    Id = IdFor(s.Name),
                    Name = s.Name,
                    Category = s.Category,
                    Kcal = s.Kcal,
                    ProteinG = s.ProteinG,
                    CarbsG = s.CarbsG,
                    FatG = s.FatG,
                    FiberG = s.FiberG,
                    SodiumMg = s.SodiumMg,
                    UnitWeightG = s.UnitWeightG,
                    GlycemicGrade = s.GlycemicGrade,
                    WeightLossGrade = s.WeightLossGrade,
                    GradesReason = s.Reason,
                    Source = "generic",
                    CreatedBy = createdBy,
                    CreatedAt = now,
                    UpdatedAt = now,
                    Version = version,
                });
            }
            return Task.CompletedTask;
        }, ct);

        return missing.Count;
    }

    static Guid IdFor(string name) => new(MD5.HashData(Encoding.UTF8.GetBytes($"macromate-seed:{name}")));
}

using MacroMate.Api.Admin;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Auth;

public static class DemoData
{
    sealed record Part(string Food, double Grams);

    sealed record RecipeSeed(string Ro, string En, int PrepTimeMin, string InstructionsRo, string InstructionsEn, Part[] Parts);

    sealed record Totals(double Kcal, double ProteinG, double CarbsG, double FatG, double FiberG, double SodiumMg)
    {
        public static Totals Of(Food food, double grams)
        {
            var f = grams / 100;
            return new(food.Kcal * f, food.ProteinG * f, food.CarbsG * f, food.FatG * f, food.FiberG * f, food.SodiumMg * f);
        }

        public static Totals operator +(Totals a, Totals b) =>
            new(a.Kcal + b.Kcal, a.ProteinG + b.ProteinG, a.CarbsG + b.CarbsG, a.FatG + b.FatG, a.FiberG + b.FiberG, a.SodiumMg + b.SodiumMg);
    }

    static readonly RecipeSeed[] Recipes =
    [
        new("Omletă cu spanac", "Spinach omelette", 10,
            "Călești spanacul în ulei.\nAdaugi ouăle bătute și le lași 3–4 minute la foc mic.",
            "Wilt the spinach in the oil.\nAdd the beaten eggs and cook for 3–4 minutes on low heat.",
            [new("Ou întreg", 167), new("Spanac", 100), new("Ulei de măsline", 10)]),
        new("Pui cu orez și broccoli", "Chicken with rice and broccoli", 25,
            "Fierbi orezul.\nTai puiul cuburi și îl rumenești în ulei.\nFierbi broccoli la abur 5 minute.",
            "Boil the rice.\nCut the chicken into cubes and brown it in the oil.\nSteam the broccoli for 5 minutes.",
            [new("Piept de pui", 150), new("Orez alb", 70), new("Broccoli", 150), new("Ulei de măsline", 5)]),
        new("Iaurt cu afine și ovăz", "Yogurt with blueberries and oats", 5,
            "Amesteci iaurtul cu ovăzul.\nPui afinele și mierea deasupra.",
            "Mix the yogurt with the oats.\nTop with the blueberries and honey.",
            [new("Iaurt grecesc 2%", 200), new("Afine", 100), new("Fulgi de ovăz", 30), new("Miere", 10)]),
    ];

    public static async Task SeedAsync(AppDbContext db, AppUser user, bool english, CancellationToken ct)
    {
        var names = Recipes.SelectMany(r => r.Parts).Select(p => p.Food).Append("Somon").Append("Cartofi dulci").Distinct().ToList();
        var ids = names.ToDictionary(n => n, SeedFoods.IdFor);
        var foods = await db.Foods.AsNoTracking().Where(f => ids.Values.Contains(f.Id) && f.DeletedAt == null).ToDictionaryAsync(f => f.Id, ct);
        Food? Find(string name) => foods.GetValueOrDefault(ids[name]);
        string Label(string ro, string en) => english ? en : ro;
        string FoodName(Food food) => english && !string.IsNullOrWhiteSpace(food.NameEn) ? food.NameEn : food.Name;

        await SyncWriter.WriteAsync(db, (version, now) =>
        {
            var today = DateOnly.FromDateTime(now.UtcDateTime);

            T Stamp<T>(T row) where T : SyncEntity
            {
                row.Id = row.Id == Guid.Empty ? Guid.NewGuid() : row.Id;
                row.CreatedAt = now;
                row.UpdatedAt = now;
                row.Version = version;
                return row;
            }

            db.UserProfiles.Add(Stamp(new UserProfile
            {
                Id = user.Id,
                UserId = user.Id,
                Sex = "male",
                BirthYear = 1994,
                HeightCm = 178,
                WeightKg = 77,
                ActivityLevel = "light",
                Goal = "lose",
                GoalWeightKg = 72,
                WeeklyRateKg = 0.5,
                GoalStartWeightKg = 78,
                GoalStartDate = today.AddDays(-21),
                TargetKcal = 1800,
                TargetProteinG = 150,
                TargetCarbsG = 165,
                TargetFatG = 60,
                TargetFiberG = 25,
                TargetSodiumMg = 2300,
            }));

            for (var i = 0; i <= 7; i++)
                db.WeightEntries.Add(Stamp(new WeightEntry { UserId = user.Id, Date = today.AddDays(-21 + i * 3), WeightKg = Math.Round(78 - i * 0.2, 1) }));

            var variants = new List<(RecipeVariant Variant, string Name, Totals Totals)>();
            foreach (var seed in Recipes)
            {
                var parts = seed.Parts.Select(p => (Food: Find(p.Food), p.Grams)).ToList();
                if (parts.Any(p => p.Food is null))
                    continue;
                var totals = parts.Aggregate(new Totals(0, 0, 0, 0, 0, 0), (sum, p) => sum + Totals.Of(p.Food!, p.Grams));
                var recipe = Stamp(new Recipe
                {
                    KitchenId = user.KitchenId,
                    CreatedBy = user.Id,
                    Name = Label(seed.Ro, seed.En),
                    Instructions = Label(seed.InstructionsRo, seed.InstructionsEn),
                    PrepTimeMin = seed.PrepTimeMin,
                    Difficulty = "easy",
                    IngredientFoodIds = parts.Select(p => p.Food!.Id).ToList(),
                });
                db.Recipes.Add(recipe);
                var variant = Stamp(new RecipeVariant
                {
                    KitchenId = user.KitchenId,
                    CreatedBy = user.Id,
                    RecipeId = recipe.Id,
                    Name = $"{Math.Round(totals.Kcal)} kcal",
                    Servings = 1,
                    Ingredients = parts.Select(p => new VariantIngredient { FoodId = p.Food!.Id, Grams = p.Grams }).ToList(),
                });
                db.RecipeVariants.Add(variant);
                variants.Add((variant, recipe.Name, totals));
            }

            foreach (var foodId in foods.Keys)
                db.PantryItems.Add(Stamp(new PantryItem { Id = PantryItem.IdFor(user.KitchenId, foodId), KitchenId = user.KitchenId, CreatedBy = user.Id, FoodId = foodId }));

            if (variants.Count < 3)
                return Task.CompletedTask;

            var meals = new List<(Meal Meal, List<(MealItem Item, string Name, Totals Totals)> Items)>();
            void AddMeal(string label, params (MealItem Item, string Name, Totals Totals)[] items) =>
                meals.Add((new Meal { Id = Guid.NewGuid(), Label = label, Items = items.Select(i => i.Item).ToList() }, items.ToList()));
            (MealItem, string, Totals) Variant(int index) =>
                (new MealItem { Id = Guid.NewGuid(), Kind = "variant", VariantId = variants[index].Variant.Id, Servings = 1 }, variants[index].Name, variants[index].Totals);
            (MealItem, string, Totals)? Single(string name, double grams) =>
                Find(name) is { } food ? (new MealItem { Id = Guid.NewGuid(), Kind = "food", FoodId = food.Id, Grams = grams }, FoodName(food), Totals.Of(food, grams)) : null;

            AddMeal(Label("Mic dejun", "Breakfast"), Variant(0));
            AddMeal(Label("Prânz", "Lunch"), Variant(1));
            AddMeal(Label("Gustare", "Snack"), Variant(2));
            var dinner = new[] { Single("Somon", 150), Single("Cartofi dulci", 200) }.Where(i => i is not null).Select(i => i!.Value).ToArray();
            if (dinner.Length > 0)
                AddMeal(Label("Cină", "Dinner"), dinner);

            var plan = Stamp(new MealPlan
            {
                KitchenId = user.KitchenId,
                CreatedBy = user.Id,
                Name = Label("Zi obișnuită", "Regular day"),
                Meals = meals.Select(m => m.Meal).ToList(),
            });
            db.MealPlans.Add(plan);

            for (var offset = -6; offset <= 0; offset++)
            {
                var date = today.AddDays(offset);
                db.DayPlans.Add(Stamp(new DayPlan { UserId = user.Id, Date = date, MealPlanId = plan.Id, CompletedAt = offset < 0 ? now : null }));
                foreach (var (meal, items) in offset < 0 ? meals : meals.Take(1))
                {
                    foreach (var (item, name, totals) in items)
                    {
                        db.JournalEntries.Add(Stamp(new JournalEntry
                        {
                            UserId = user.Id,
                            Date = date,
                            MealLabel = meal.Label,
                            MealItemId = item.Id,
                            Kind = item.Kind,
                            VariantId = item.VariantId,
                            Servings = item.Servings,
                            FoodId = item.FoodId,
                            Grams = item.Grams,
                            Name = name,
                            Kcal = Math.Round(totals.Kcal, 1),
                            ProteinG = Math.Round(totals.ProteinG, 1),
                            CarbsG = Math.Round(totals.CarbsG, 1),
                            FatG = Math.Round(totals.FatG, 1),
                            FiberG = Math.Round(totals.FiberG, 1),
                            SodiumMg = Math.Round(totals.SodiumMg),
                        }));
                    }
                }
            }
            return Task.CompletedTask;
        }, ct);
    }
}

using MacroMate.Api.Data;

namespace MacroMate.Api.Features.Sync;

public static class SyncRules
{
    static readonly string[] Grades = ["A", "B", "C"];
    static readonly string[] Difficulties = ["easy", "medium", "hard"];
    static readonly string[] Sexes = ["male", "female"];
    static readonly string[] ActivityLevels = ["sedentary", "light", "moderate", "very_active"];
    static readonly string[] Goals = ["lose", "maintain", "gain"];

    public static string? Food(Food f)
    {
        if (string.IsNullOrWhiteSpace(f.Name)) return "name-required";
        if (!FoodCategories.IsValid(f.Category)) return "invalid-category";
        if (!InRange(f.Kcal, 0, 900)) return "invalid-kcal";
        if (!InRange(f.ProteinG, 0, 100) || !InRange(f.CarbsG, 0, 100) || !InRange(f.FatG, 0, 100) || !InRange(f.FiberG, 0, 100))
            return "invalid-macros";
        if (!InRange(f.SodiumMg, 0, 40000)) return "invalid-sodium";
        if (f.UnitWeightG is { } unit && !InRange(unit, 0.1, 5000)) return "invalid-unit-weight";
        if (f.GlycemicGrade is { } glycemic && !Grades.Contains(glycemic)) return "invalid-glycemic-grade";
        if (f.WeightLossGrade is { } weightLoss && !Grades.Contains(weightLoss)) return "invalid-weight-loss-grade";
        return null;
    }

    public static string? Recipe(Recipe r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return "name-required";
        if (!Difficulties.Contains(r.Difficulty)) return "invalid-difficulty";
        if (r.PrepTimeMin is < 0 or > 1440) return "invalid-prep-time";
        return null;
    }

    public static string? RecipeVariant(RecipeVariant v)
    {
        if (v.RecipeId == Guid.Empty) return "recipe-required";
        if (string.IsNullOrWhiteSpace(v.Name)) return "name-required";
        if (v.Servings is < 1 or > 100) return "invalid-servings";
        if (v.Ingredients.Any(i => i.FoodId == Guid.Empty || !InRange(i.Grams, 0.1, 20000))) return "invalid-ingredient";
        return null;
    }

    public static string? MealPlan(MealPlan p)
    {
        if (string.IsNullOrWhiteSpace(p.Name)) return "name-required";
        if (p.Meals.Count > 5) return "too-many-meals";
        foreach (var item in p.Meals.SelectMany(m => m.Items))
        {
            var valid = item.Kind switch
            {
                "variant" => item.VariantId is not null && item.Servings is > 0 and <= 50,
                "food" => item.FoodId is not null && item.Grams is > 0 and <= 20000,
                _ => false,
            };
            if (!valid) return "invalid-meal-item";
        }
        return null;
    }

    public static string? ShoppingList(ShoppingList s)
    {
        if (string.IsNullOrWhiteSpace(s.Name)) return "name-required";
        if (s.Plans.Any(p => p.MealPlanId == Guid.Empty || p.Days is < 1 or > 60)) return "invalid-plan";
        return null;
    }

    public static string? DayPlan(DayPlan d) => null;

    public static string? WeightEntry(WeightEntry w) =>
        InRange(w.WeightKg, 20, 400) ? null : "invalid-weight";

    public static string? JournalEntry(JournalEntry j)
    {
        if (string.IsNullOrWhiteSpace(j.Name)) return "name-required";
        if (j.Kind is not ("food" or "variant")) return "invalid-kind";
        if (!InRange(j.Kcal, 0, 20000)) return "invalid-kcal";
        return null;
    }

    public static string? UserProfile(UserProfile p)
    {
        if (p.Sex is { } sex && !Sexes.Contains(sex)) return "invalid-sex";
        if (p.ActivityLevel is { } level && !ActivityLevels.Contains(level)) return "invalid-activity";
        if (p.Goal is { } goal && !Goals.Contains(goal)) return "invalid-goal";
        if (p.ExcludedCategories.Any(c => !FoodCategories.IsValid(c))) return "invalid-category";
        return null;
    }

    static bool InRange(double value, double min, double max) =>
        double.IsFinite(value) && value >= min && value <= max;
}

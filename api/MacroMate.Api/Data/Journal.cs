namespace MacroMate.Api.Data;

public class DayPlan : PersonalEntity
{
    public DateOnly Date { get; set; }
    public Guid? MealPlanId { get; set; }
}

public class JournalEntry : PersonalEntity
{
    public DateOnly Date { get; set; }
    public string MealLabel { get; set; } = "";
    public Guid? MealItemId { get; set; }
    public string Kind { get; set; } = "food";
    public Guid? VariantId { get; set; }
    public double? Servings { get; set; }
    public Guid? FoodId { get; set; }
    public double? Grams { get; set; }
    public string Name { get; set; } = "";
    public double Kcal { get; set; }
    public double ProteinG { get; set; }
    public double CarbsG { get; set; }
    public double FatG { get; set; }
    public double FiberG { get; set; }
    public double SodiumMg { get; set; }
}

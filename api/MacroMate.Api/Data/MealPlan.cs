namespace MacroMate.Api.Data;

public class MealPlan : KitchenEntity
{
    public string Name { get; set; } = "";
    public List<Meal> Meals { get; set; } = [];
}

public class Meal
{
    public Guid Id { get; set; }
    public string Label { get; set; } = "";
    public List<MealItem> Items { get; set; } = [];
}

public class MealItem
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "food";
    public Guid? VariantId { get; set; }
    public double? Servings { get; set; }
    public Guid? FoodId { get; set; }
    public double? Grams { get; set; }
}

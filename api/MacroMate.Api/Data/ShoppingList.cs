namespace MacroMate.Api.Data;

public class ShoppingList : KitchenEntity
{
    public string Name { get; set; } = "";
    public List<ShoppingListPlan> Plans { get; set; } = [];
    public List<string> CheckedKeys { get; set; } = [];
}

public class ShoppingListPlan
{
    public Guid MealPlanId { get; set; }
    public int Days { get; set; } = 1;
}

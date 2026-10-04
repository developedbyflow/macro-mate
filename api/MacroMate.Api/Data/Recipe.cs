namespace MacroMate.Api.Data;

public class Recipe : SharedEntity
{
    public string Name { get; set; } = "";
    public string Instructions { get; set; } = "";
    public int? PrepTimeMin { get; set; }
    public string Difficulty { get; set; } = "easy";
    public Guid? PhotoId { get; set; }
    public List<Guid> IngredientFoodIds { get; set; } = [];
}

public class RecipeVariant : SharedEntity
{
    public Guid RecipeId { get; set; }
    public string Name { get; set; } = "";
    public int Servings { get; set; } = 1;
    public List<VariantIngredient> Ingredients { get; set; } = [];
}

public class VariantIngredient
{
    public Guid FoodId { get; set; }
    public double Grams { get; set; }
}

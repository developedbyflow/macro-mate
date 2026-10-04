namespace MacroMate.Api.Data;

public class UserProfile : PersonalEntity
{
    public string? Sex { get; set; }
    public int? BirthYear { get; set; }
    public double? HeightCm { get; set; }
    public double? WeightKg { get; set; }
    public string? ActivityLevel { get; set; }
    public string? Goal { get; set; }
    public double? TargetKcal { get; set; }
    public double? TargetProteinG { get; set; }
    public double? TargetCarbsG { get; set; }
    public double? TargetFatG { get; set; }
    public double? TargetFiberG { get; set; }
    public double? TargetSodiumMg { get; set; }
    public List<Guid> FavoriteFoodIds { get; set; } = [];
    public List<Guid> FavoriteRecipeIds { get; set; } = [];
    public List<Guid> ExcludedFoodIds { get; set; } = [];
    public List<string> ExcludedCategories { get; set; } = [];
    public List<Guid> ExcludedRecipeIds { get; set; } = [];
    public List<Guid> LikedFoodIds { get; set; } = [];
}

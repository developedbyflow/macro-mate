namespace MacroMate.Api.Data;

public class WeightEntry : PersonalEntity
{
    public DateOnly Date { get; set; }
    public double WeightKg { get; set; }
}

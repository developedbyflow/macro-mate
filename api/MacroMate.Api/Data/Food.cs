namespace MacroMate.Api.Data;

public class Food : SharedEntity
{
    public string Name { get; set; } = "";
    public string? Brand { get; set; }
    public string? Barcode { get; set; }
    public string Category { get; set; } = "";
    public double Kcal { get; set; }
    public double ProteinG { get; set; }
    public double CarbsG { get; set; }
    public double FatG { get; set; }
    public double FiberG { get; set; }
    public double SodiumMg { get; set; }
    public double? UnitWeightG { get; set; }
    public string? InsulinGrade { get; set; }
    public int? WeightLossScore { get; set; }
    public string? ScoresReason { get; set; }
    public List<string> EstimatedFields { get; set; } = [];
    public string Source { get; set; } = "manual";
    public Guid? PhotoId { get; set; }
}

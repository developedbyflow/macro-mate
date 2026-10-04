namespace MacroMate.Api.Data;

public class Food : SharedEntity
{
    public string Name { get; set; } = "";
    public string? NameEn { get; set; }
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
    public string? GlycemicGrade { get; set; }
    public string? GradesReason { get; set; }
    public string? GradesReasonEn { get; set; }
    public List<string> EstimatedFields { get; set; } = [];
    public string Source { get; set; } = "manual";
    public Guid? PhotoId { get; set; }
    public Guid? KitchenId { get; set; }

    public override void KeepServerFieldsFrom(SyncEntity existing)
    {
        base.KeepServerFieldsFrom(existing);
        KitchenId = ((Food)existing).KitchenId;
    }
}

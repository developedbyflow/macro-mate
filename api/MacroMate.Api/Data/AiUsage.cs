namespace MacroMate.Api.Data;

public class AiUsage
{
    public Guid UserId { get; set; }
    public DateOnly Day { get; set; }
    public int Count { get; set; }
}

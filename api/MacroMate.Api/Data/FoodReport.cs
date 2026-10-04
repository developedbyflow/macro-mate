namespace MacroMate.Api.Data;

public class FoodReport
{
    public Guid Id { get; set; }
    public Guid FoodId { get; set; }
    public Guid UserId { get; set; }
    public string Message { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}

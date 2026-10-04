using System.Security.Cryptography;
using System.Text;

namespace MacroMate.Api.Data;

public class Kitchen
{
    public Guid Id { get; set; }
    public Guid? OwnerId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class KitchenInvite
{
    public string Token { get; set; } = "";
    public Guid KitchenId { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public Guid? UsedBy { get; set; }
}

public abstract class KitchenEntity : SharedEntity
{
    public Guid KitchenId { get; set; }

    public override void KeepServerFieldsFrom(SyncEntity existing)
    {
        base.KeepServerFieldsFrom(existing);
        KitchenId = ((KitchenEntity)existing).KitchenId;
    }
}

public class PantryItem : KitchenEntity
{
    public Guid FoodId { get; set; }

    public static Guid IdFor(Guid kitchenId, Guid foodId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{kitchenId}:{foodId}"));
        return new Guid(Convert.ToHexString(hash, 0, 16));
    }
}

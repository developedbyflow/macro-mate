using Microsoft.AspNetCore.Identity;

namespace MacroMate.Api.Data;

public class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";
    public Guid KitchenId { get; set; }
    public Guid? ArchiveKitchenId { get; set; }
}

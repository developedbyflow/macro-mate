using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public const string VersionSequence = "sync_version";

    public DbSet<Food> Foods => Set<Food>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeVariant> RecipeVariants => Set<RecipeVariant>();
    public DbSet<MealPlan> MealPlans => Set<MealPlan>();
    public DbSet<ShoppingList> ShoppingLists => Set<ShoppingList>();
    public DbSet<DayPlan> DayPlans => Set<DayPlan>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasSequence<long>(VersionSequence);

        builder.Entity<Food>(b =>
        {
            b.HasIndex(f => f.Version);
            b.HasIndex(f => f.Barcode);
            b.Property(f => f.Name).HasMaxLength(200);
            b.Property(f => f.Brand).HasMaxLength(200);
            b.Property(f => f.Barcode).HasMaxLength(32);
            b.Property(f => f.Category).HasMaxLength(40);
            b.Property(f => f.GlycemicGrade).HasMaxLength(1);
            b.Property(f => f.Source).HasMaxLength(20);
        });

        builder.Entity<Recipe>(b =>
        {
            b.HasIndex(r => r.Version);
            b.Property(r => r.Name).HasMaxLength(200);
            b.Property(r => r.Difficulty).HasMaxLength(10);
        });

        builder.Entity<RecipeVariant>(b =>
        {
            b.HasIndex(v => v.Version);
            b.HasIndex(v => v.RecipeId);
            b.Property(v => v.Name).HasMaxLength(100);
            b.ComplexCollection(v => v.Ingredients, c => c.ToJson());
        });

        builder.Entity<MealPlan>(b =>
        {
            b.HasIndex(p => p.Version);
            b.Property(p => p.Name).HasMaxLength(200);
            b.ComplexCollection(p => p.Meals, meals =>
            {
                meals.ToJson();
                meals.ComplexCollection(m => m.Items);
            });
        });

        builder.Entity<ShoppingList>(b =>
        {
            b.HasIndex(s => s.Version);
            b.Property(s => s.Name).HasMaxLength(200);
            b.ComplexCollection(s => s.Plans, c => c.ToJson());
        });

        builder.Entity<DayPlan>(b =>
        {
            b.HasIndex(d => d.Version);
            b.HasIndex(d => new { d.UserId, d.Date });
        });

        builder.Entity<JournalEntry>(b =>
        {
            b.HasIndex(j => j.Version);
            b.HasIndex(j => new { j.UserId, j.Date });
            b.Property(j => j.MealLabel).HasMaxLength(60);
            b.Property(j => j.Name).HasMaxLength(200);
        });

        builder.Entity<WeightEntry>(b =>
        {
            b.HasIndex(w => w.Version);
            b.HasIndex(w => new { w.UserId, w.Date });
        });

        builder.Entity<UserProfile>(b =>
        {
            b.HasIndex(p => p.Version);
            b.HasIndex(p => p.UserId).IsUnique();
        });

        builder.Entity<AppUser>(b =>
        {
            b.ToTable("users");
            b.Property(u => u.DisplayName).HasMaxLength(60);
        });
        builder.Entity<IdentityRole<Guid>>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");
    }
}

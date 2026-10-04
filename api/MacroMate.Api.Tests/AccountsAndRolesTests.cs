using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Admin;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static MacroMate.Api.Tests.SyncCalls;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class AccountsAndRolesTests(ApiFactory factory)
{
    static object FoodData(string name) => new { name, category = "dairy", kcal = 60, proteinG = 3, carbsG = 4, fatG = 3 };

    static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(JsonSerializerOptions.Web))!;
    }

    static async Task<string> DetailAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString()!;

    async Task<HttpStatusCode> LoginStatusAsync(string email, string password) =>
        (await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password })).StatusCode;

    async Task<Guid> UserIdAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
    }

    [Fact]
    public async Task A_new_account_works_only_after_the_emailed_link_is_opened()
    {
        var email = ApiFactory.NewEmail("Ioana");
        var guest = factory.CreateClient();

        var registered = await guest.PostAsJsonAsync("/api/auth/register", new { email, displayName = "Ioana", password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Accepted, registered.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, await LoginStatusAsync(email, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(email, "parola-gresita-123"));

        var query = QueryHelpers.ParseQuery(factory.Outbox.LinkFor(email).Query);
        var confirmed = await ReadAsync<MeResponse>(await guest.PostAsJsonAsync("/api/auth/confirm-account", new { userId = Guid.Parse(query["userId"]!), token = query["token"].ToString() }));

        Assert.Equal(email, confirmed.Email);
        Assert.False(confirmed.IsAdmin);
        Assert.NotEqual(Guid.Empty, (await PullAsync(guest, 0)).KitchenId);
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(email, ApiFactory.Password));

        var again = await factory.CreateClient().PostAsJsonAsync("/api/auth/register", new { email, displayName = "Ioana", password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task A_confirmation_without_a_valid_token_never_signs_anyone_in()
    {
        var email = await factory.CreateUserAsync("Ana");
        var userId = await UserIdAsync(email);
        var attacker = factory.CreateClient();

        var response = await attacker.PostAsJsonAsync("/api/auth/confirm-account", new { userId, token = "AA" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await attacker.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task A_users_new_food_stays_inside_their_kitchen()
    {
        var ana = await factory.NewUserAsync("Ana");
        var bob = await factory.NewUserAsync("Bob");
        var foodId = Guid.NewGuid();

        await PushAsync(ana, Upsert("foods", foodId, FoodData("Kefir de casă")));

        var mine = (await PullAsync(ana, 0)).Foods.Single(f => f.Id == foodId);
        Assert.Equal((await PullAsync(ana, 0)).KitchenId, mine.KitchenId);
        Assert.DoesNotContain((await PullAsync(bob, 0)).Foods, f => f.Id == foodId);
    }

    [Fact]
    public async Task Base_foods_are_read_only_for_users_and_editable_by_admins()
    {
        var admin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var ana = await factory.NewUserAsync("Ana");
        var foodId = Guid.NewGuid();

        await PushAsync(admin, Upsert("foods", foodId, FoodData("Iaurt de bază")));
        var seen = (await PullAsync(ana, 0)).Foods.Single(f => f.Id == foodId);
        Assert.Null(seen.KitchenId);

        var refused = await PushAsync(ana, Upsert("foods", foodId, FoodData("Iaurt schimbat")));
        Assert.Contains(refused.Rejected, r => r.Id == foodId && r.Reason == "not-owner");

        var accepted = await PushAsync(admin, Upsert("foods", foodId, FoodData("Iaurt corectat")));
        Assert.Empty(accepted.Rejected);
        Assert.Equal("Iaurt corectat", (await PullAsync(ana, 0)).Foods.Single(f => f.Id == foodId).Name);
    }

    [Fact]
    public async Task Only_admins_manage_roles_and_the_last_admin_keeps_the_role()
    {
        var admin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var anaEmail = await factory.CreateUserAsync("Ana");
        var ana = await factory.LoginAsync(anaEmail);
        var anaId = await UserIdAsync(anaEmail);
        var florinId = await UserIdAsync(ApiFactory.FlorinEmail);

        Assert.Equal(HttpStatusCode.Forbidden, (await ana.GetAsync("/api/admin/users")).StatusCode);

        var promoted = await ReadAsync<AdminUser>(await admin.PutAsJsonAsync($"/api/admin/users/{anaId}/role", new { admin = true }));
        Assert.True(promoted.IsAdmin);
        Assert.Equal(HttpStatusCode.OK, (await ana.GetAsync("/api/admin/users")).StatusCode);
        Assert.True((await ana.GetFromJsonAsync<MeResponse>("/api/auth/me", JsonSerializerOptions.Web))!.IsAdmin);

        (await admin.PutAsJsonAsync($"/api/admin/users/{anaId}/role", new { admin = false })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await ana.GetAsync("/api/admin/users")).StatusCode);

        var users = await ReadAsync<List<AdminUser>>(await admin.GetAsync("/api/admin/users"));
        Assert.Equal([florinId], users.Where(u => u.IsAdmin).Select(u => u.Id));
        var last = await admin.PutAsJsonAsync($"/api/admin/users/{florinId}/role", new { admin = false });
        Assert.Equal(HttpStatusCode.Conflict, last.StatusCode);
    }

    [Fact]
    public async Task The_admin_sees_which_foods_kitchens_add_and_can_move_one_into_the_base()
    {
        var admin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var ana = await factory.NewUserAsync("Ana");
        var bob = await factory.NewUserAsync("Bob");
        var name = $"Kefir {Guid.NewGuid():N}";
        var anaFood = Guid.NewGuid();
        await PushAsync(ana, Upsert("foods", anaFood, FoodData(name)));
        await PushAsync(bob, Upsert("foods", Guid.NewGuid(), FoodData(name.ToUpperInvariant() + " ")));

        var demand = await ReadAsync<List<FoodDemand>>(await admin.GetAsync("/api/admin/food-demand"));
        var row = demand.Single(d => AdminEndpoints.NormalizeName(d.Name) == AdminEndpoints.NormalizeName(name));
        Assert.Equal(2, row.Kitchens);
        Assert.False(row.InBase);

        Assert.Equal(HttpStatusCode.Forbidden, (await ana.PostAsync($"/api/admin/food-demand/{anaFood}/promote", null)).StatusCode);
        var promoted = await ReadAsync<PromotedFood>(await admin.PostAsync($"/api/admin/food-demand/{anaFood}/promote", null));

        var bobView = (await PullAsync(bob, 0)).Foods;
        Assert.Contains(bobView, f => f.Id == promoted.FoodId && f.KitchenId == null && f.Name == name);
        Assert.Contains((await PullAsync(ana, 0)).Foods, f => f.Id == anaFood);
        var after = await ReadAsync<List<FoodDemand>>(await admin.GetAsync("/api/admin/food-demand"));
        Assert.True(after.Single(d => AdminEndpoints.NormalizeName(d.Name) == AdminEndpoints.NormalizeName(name)).InBase);
    }

    [Fact]
    public async Task A_wrong_value_in_the_base_is_reported_to_the_admin()
    {
        var admin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var ana = await factory.NewUserAsync("Ana");
        var baseFood = (await PullAsync(ana, 0)).Foods.First(f => f.KitchenId == null);
        var kitchenFood = Guid.NewGuid();
        await PushAsync(ana, Upsert("foods", kitchenFood, FoodData("Brânza mea")));

        var message = $"Proteina e prea mare {Guid.NewGuid():N}";
        Assert.Equal(HttpStatusCode.NoContent, (await ana.PostAsJsonAsync($"/api/foods/{baseFood.Id}/reports", new { message })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ana.PostAsJsonAsync($"/api/foods/{kitchenFood}/reports", new { message })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ana.PostAsJsonAsync($"/api/foods/{baseFood.Id}/reports", new { message = "x" })).StatusCode);

        var report = (await ReadAsync<List<OpenReport>>(await admin.GetAsync("/api/admin/reports"))).Single(r => r.Message == message);
        Assert.Equal(baseFood.Name, report.FoodName);
        Assert.Equal("Ana", report.ReporterName);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/reports/{report.Id}/resolve", null)).StatusCode);
        Assert.DoesNotContain(await ReadAsync<List<OpenReport>>(await admin.GetAsync("/api/admin/reports")), r => r.Id == report.Id);
    }

    [Fact]
    public async Task Leaving_a_kitchen_copies_its_foods_and_points_the_copied_recipes_at_them()
    {
        var ana = await factory.NewUserAsync("Ana");
        var bob = await factory.NewUserAsync("Bob");
        var foodId = Guid.NewGuid();
        var recipeId = Guid.NewGuid();
        await PushAsync(ana,
            Upsert("foods", foodId, FoodData("Kefir de țară")),
            Upsert("recipes", recipeId, new { name = "Smoothie", difficulty = "easy", ingredientFoodIds = new[] { foodId } }),
            Upsert("recipeVariants", Guid.NewGuid(), new { recipeId, name = "Mare", servings = 1, ingredients = new[] { new { foodId, grams = 200 } } }));

        var token = (await ReadAsync<InviteCreated>(await ana.PostAsync("/api/kitchen/invites", null))).Token;
        (await bob.PostAsJsonAsync($"/api/invites/{token}/accept", new { bringMine = true })).EnsureSuccessStatusCode();
        Assert.Contains((await PullAsync(bob, 0)).Foods, f => f.Id == foodId);

        (await bob.PostAsync("/api/kitchen/leave", null)).EnsureSuccessStatusCode();

        var view = await PullAsync(bob, 0);
        var copy = view.Foods.Single(f => f.Name == "Kefir de țară");
        Assert.NotEqual(foodId, copy.Id);
        Assert.Equal(view.KitchenId, copy.KitchenId);
        var recipe = view.Recipes.Single(r => r.Name == "Smoothie");
        Assert.Equal([copy.Id], recipe.IngredientFoodIds);
        Assert.Equal(copy.Id, view.RecipeVariants.Single(v => v.RecipeId == recipe.Id).Ingredients.Single().FoodId);
        Assert.Contains((await PullAsync(ana, 0)).Foods, f => f.Id == foodId);
    }

    [Fact]
    public async Task Deleting_an_account_removes_its_data_and_its_kitchen()
    {
        var email = await factory.CreateUserAsync("Ana");
        var ana = await factory.LoginAsync(email);
        var userId = await UserIdAsync(email);
        var kitchenId = (await PullAsync(ana, 0)).KitchenId;
        await PushAsync(ana,
            Upsert("foods", Guid.NewGuid(), FoodData("Iaurt de șters")),
            Upsert("weightEntries", Guid.NewGuid(), new { date = "2026-10-01", weightKg = 70 }));

        Assert.Equal(HttpStatusCode.BadRequest, (await ana.PostAsJsonAsync("/api/auth/me/delete", new { password = "gresita-123456" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ana.PostAsJsonAsync("/api/auth/me/delete", new { password = ApiFactory.Password })).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(email, ApiFactory.Password));
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Foods.AnyAsync(f => f.KitchenId == kitchenId));
        Assert.False(await db.WeightEntries.AnyAsync(w => w.UserId == userId));
        Assert.False(await db.Kitchens.AnyAsync(k => k.Id == kitchenId));
    }

    [Fact]
    public async Task The_last_admin_cannot_delete_the_account()
    {
        var admin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var response = await admin.PostAsJsonAsync("/api/auth/me/delete", new { password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_demo_account_comes_with_sample_data_and_is_removed_after_a_day()
    {
        var demo = factory.CreateClient();
        demo.DefaultRequestHeaders.Add("Accept-Language", "en");

        var me = await ReadAsync<MeResponse>(await demo.PostAsync("/api/auth/demo", null));
        Assert.True(me.IsDemo);
        Assert.NotNull(me.DemoExpiresAt);

        var view = await PullAsync(demo, 0);
        Assert.Equal(3, view.Recipes.Count);
        Assert.Contains(view.Recipes, r => r.Name == "Spinach omelette");
        Assert.Single(view.MealPlans);
        Assert.NotEmpty(view.JournalEntries);
        Assert.NotEmpty(view.WeightEntries);
        Assert.Equal(1800, view.UserProfiles.Single().TargetKcal);

        var change = await demo.PostAsJsonAsync("/api/auth/me/password", new { currentPassword = "x", newPassword = "parola-noua-2026" });
        Assert.Equal(HttpStatusCode.Forbidden, change.StatusCode);

        var deleted = await DemoCleanup.DeleteExpiredAsync(factory.Services.GetRequiredService<IServiceScopeFactory>(), DateTimeOffset.UtcNow.AddHours(25), CancellationToken.None);
        Assert.True(deleted >= 1);
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.AnyAsync(u => u.Id == me.Id));
        Assert.Equal(HttpStatusCode.Unauthorized, (await demo.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task A_demo_account_has_a_small_daily_ai_limit()
    {
        var demo = factory.CreateClient();
        demo.DefaultRequestHeaders.Add("Accept-Language", "en");
        (await demo.PostAsync("/api/auth/demo", null)).EnsureSuccessStatusCode();

        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await demo.PostAsJsonAsync("/api/ai/meals/scan", new { imageDataUrl = "x" })).StatusCode);

        var refused = await demo.PostAsJsonAsync("/api/ai/meals/scan", new { imageDataUrl = "x" });
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal("You've used today's 5 AI requests. You can use AI again tomorrow.", await DetailAsync(refused));
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Kitchens;
using static MacroMate.Api.Tests.SyncCalls;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class KitchenTests(ApiFactory factory)
{
    static object Recipe(string name) => new { name, difficulty = "easy", ingredientFoodIds = Array.Empty<Guid>() };

    static async Task<Guid> AddRecipeAsync(HttpClient client, string name)
    {
        var id = Guid.NewGuid();
        await PushAsync(client, Upsert("recipes", id, Recipe(name)));
        return id;
    }

    static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(JsonSerializerOptions.Web))!;
    }

    static async Task<string> InviteAsync(HttpClient client) =>
        (await ReadAsync<InviteCreated>(await client.PostAsync("/api/kitchen/invites", null))).Token;

    static Task<HttpResponseMessage> AcceptAsync(HttpClient client, string token, bool bringMine) =>
        client.PostAsJsonAsync($"/api/invites/{token}/accept", new { bringMine });

    [Fact]
    public async Task Recipes_stay_inside_their_kitchen()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");

        var recipeId = await AddRecipeAsync(ana, "Supă");

        Assert.DoesNotContain((await PullAsync(dan, 0)).Recipes, r => r.Id == recipeId);
        var change = await PushAsync(dan, Upsert("recipes", recipeId, Recipe("Supă furată")));
        Assert.Contains(change.Rejected, r => r.Id == recipeId && r.Reason == "not-owner");
    }

    [Fact]
    public async Task Joining_with_yes_brings_your_recipes_and_pantry()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");
        var food = (await PullAsync(ana, 0)).Foods.First();
        var danKitchen = (await PullAsync(dan, 0)).KitchenId;

        var anaRecipe = await AddRecipeAsync(ana, "Omletă");
        var danRecipe = await AddRecipeAsync(dan, "Ciorbă");
        await PushAsync(dan, Upsert("pantryItems", PantryItem.IdFor(danKitchen, food.Id), new { foodId = food.Id }));

        (await AcceptAsync(dan, await InviteAsync(ana), bringMine: true)).EnsureSuccessStatusCode();

        var danView = await PullAsync(dan, 0);
        var anaView = await PullAsync(ana, 0);
        Assert.Equal(anaView.KitchenId, danView.KitchenId);
        Assert.Contains(anaView.Recipes, r => r.Id == danRecipe);
        Assert.Contains(danView.Recipes, r => r.Id == anaRecipe);
        Assert.Contains(anaView.PantryItems, p => p.FoodId == food.Id && p.DeletedAt == null);
    }

    [Fact]
    public async Task Joining_with_no_archives_your_things_and_leaving_offers_them_back()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");
        await AddRecipeAsync(ana, "Omletă");
        var danRecipe = await AddRecipeAsync(dan, "Ciorbă");

        var joined = await ReadAsync<KitchenInfo>(await AcceptAsync(dan, await InviteAsync(ana), bringMine: false));
        Assert.Equal(2, joined.Members.Count);
        Assert.Equal(1, joined.Archive?.Recipes);
        Assert.DoesNotContain((await PullAsync(dan, 0)).Recipes, r => r.Id == danRecipe);

        var left = await ReadAsync<LeaveResult>(await dan.PostAsync("/api/kitchen/leave", null));
        Assert.True(left.HasArchive);
        var copies = (await PullAsync(dan, 0)).Recipes;
        Assert.Contains(copies, r => r.Name == "Omletă");
        Assert.Contains((await PullAsync(ana, 0)).Recipes, r => r.Name == "Omletă");

        var restored = await ReadAsync<KitchenInfo>(await dan.PostAsync("/api/kitchen/archive/restore", null));
        Assert.Null(restored.Archive);
        Assert.Contains((await PullAsync(dan, 0)).Recipes, r => r.Id == danRecipe);
    }

    [Fact]
    public async Task The_inviter_leaving_gets_a_copy_and_no_archive()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");
        var anaRecipe = await AddRecipeAsync(ana, "Omletă");
        (await AcceptAsync(dan, await InviteAsync(ana), bringMine: true)).EnsureSuccessStatusCode();

        var left = await ReadAsync<LeaveResult>(await ana.PostAsync("/api/kitchen/leave", null));

        Assert.False(left.HasArchive);
        Assert.Contains((await PullAsync(dan, 0)).Recipes, r => r.Id == anaRecipe);
        var anaRecipes = (await PullAsync(ana, 0)).Recipes;
        Assert.Contains(anaRecipes, r => r.Name == "Omletă" && r.Id != anaRecipe);
    }

    [Fact]
    public async Task A_member_of_a_shared_kitchen_must_leave_before_joining_another()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");
        var ion = await factory.NewUserAsync("Ion");
        (await AcceptAsync(dan, await InviteAsync(ana), bringMine: true)).EnsureSuccessStatusCode();

        var response = await AcceptAsync(dan, await InviteAsync(ion), bringMine: true);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task An_invite_works_once_and_can_create_an_account()
    {
        var ana = await factory.NewUserAsync("Ana");
        var token = await InviteAsync(ana);
        var guest = factory.CreateClient();

        var described = await ReadAsync<InviteInfo>(await guest.GetAsync($"/api/invites/{token}"));
        Assert.Contains("Ana", described.Members);

        var email = $"maria-{Guid.NewGuid():N}@macromate.local";
        (await guest.PostAsJsonAsync($"/api/invites/{token}/register", new { token, email, displayName = "Maria", password = ApiFactory.Password })).EnsureSuccessStatusCode();
        Assert.Equal((await PullAsync(ana, 0)).KitchenId, (await PullAsync(guest, 0)).KitchenId);

        Assert.Equal(HttpStatusCode.Gone, (await factory.CreateClient().GetAsync($"/api/invites/{token}")).StatusCode);
    }

    [Fact]
    public async Task Only_the_kitchen_of_the_author_can_change_a_food()
    {
        var ana = await factory.NewUserAsync("Ana");
        var dan = await factory.NewUserAsync("Dan");
        var foodId = Guid.NewGuid();
        await PushAsync(ana, Upsert("foods", foodId, new { name = "Iaurt", category = "dairy", kcal = 60 }));

        var result = await PushAsync(dan, Upsert("foods", foodId, new { name = "Iaurt schimbat", category = "dairy", kcal = 60 }));

        Assert.Contains(result.Rejected, r => r.Id == foodId && r.Reason == "not-owner");
    }

    static async Task<KitchenInfo> KitchenAsync(HttpClient client) => await ReadAsync<KitchenInfo>(await client.GetAsync("/api/kitchen"));

    [Fact]
    public async Task Only_the_owner_can_remove_a_member()
    {
        var ana = await factory.NewUserAsync("Ana");
        var bob = await factory.NewUserAsync("Bob");
        (await AcceptAsync(bob, await InviteAsync(ana), bringMine: false)).EnsureSuccessStatusCode();

        var kitchen = await KitchenAsync(bob);
        var anaId = kitchen.Members.Single(m => m.DisplayName == "Ana").Id;
        var bobId = kitchen.Members.Single(m => m.DisplayName == "Bob").Id;
        Assert.Equal(anaId, kitchen.OwnerId);

        var refused = await bob.PostAsync($"/api/kitchen/members/{anaId}/remove", null);
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal(2, (await KitchenAsync(ana)).Members.Count);

        (await ana.PostAsync($"/api/kitchen/members/{bobId}/remove", null)).EnsureSuccessStatusCode();
        Assert.Single((await KitchenAsync(ana)).Members);
        Assert.Equal(bobId, (await KitchenAsync(bob)).OwnerId);
    }

    [Fact]
    public async Task When_the_owner_leaves_a_remaining_member_becomes_the_owner()
    {
        var ana = await factory.NewUserAsync("Ana");
        var bob = await factory.NewUserAsync("Bob");
        (await AcceptAsync(bob, await InviteAsync(ana), bringMine: false)).EnsureSuccessStatusCode();
        var bobId = (await KitchenAsync(bob)).Members.Single(m => m.DisplayName == "Bob").Id;

        (await ana.PostAsync("/api/kitchen/leave", null)).EnsureSuccessStatusCode();

        Assert.Equal(bobId, (await KitchenAsync(bob)).OwnerId);
    }

    [Fact]
    public void The_pantry_id_matches_the_one_the_phone_computes() =>
        Assert.Equal(
            Guid.Parse("cd9973c5-da8b-6820-e429-ea2f25f65312"),
            PantryItem.IdFor(Guid.Parse("01a105e7-fd66-72a6-939c-a640a2f0e930"), Guid.Parse("fffc4bba-70d3-382f-f018-94817a22877e")));

    [Fact]
    public async Task A_pantry_item_has_one_id_per_kitchen_and_food()
    {
        var ana = await factory.NewUserAsync("Ana");
        var pulled = await PullAsync(ana, 0);
        var food = pulled.Foods.First();

        var wrong = Guid.NewGuid();
        var right = PantryItem.IdFor(pulled.KitchenId, food.Id);
        var result = await PushAsync(ana, Upsert("pantryItems", wrong, new { foodId = food.Id }), Upsert("pantryItems", right, new { foodId = food.Id }));

        Assert.Contains(result.Rejected, r => r.Id == wrong && r.Reason == "cannot-create");
        await PushAsync(ana, new { table = "pantryItems", op = "delete", id = right });
        await PushAsync(ana, Upsert("pantryItems", right, new { foodId = food.Id }));
        Assert.Contains((await PullAsync(ana, 0)).PantryItems, p => p.Id == right && p.DeletedAt == null);
    }
}

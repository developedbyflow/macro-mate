using MacroMate.Api.Data;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.Identity;

namespace MacroMate.Api.Admin;

public static class AdminCommands
{
    public static bool IsCommand(string[] args) => args.Length > 0 && args[0] is "create-user" or "seed-foods";

    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var options = ParseOptions(args.Skip(1).ToArray());

        switch (args[0])
        {
            case "create-user":
            {
                if (!options.TryGetValue("email", out var email) || !options.TryGetValue("name", out var name))
                {
                    Console.Error.WriteLine("Folosire: create-user --email adresa@exemplu.ro --name Nume");
                    return 1;
                }
                var password = ReadPassword();
                var users = services.GetRequiredService<UserManager<AppUser>>();
                var (user, errors) = await KitchenService.CreateUserAsync(users, services.GetRequiredService<AppDbContext>(), email, name, password, null, CancellationToken.None);
                if (user is null)
                {
                    foreach (var error in errors)
                        Console.Error.WriteLine(error);
                    return 1;
                }
                Console.WriteLine($"Contul {email} a fost creat.");
                return 0;
            }
            case "seed-foods":
            {
                if (!options.TryGetValue("as", out var email))
                {
                    Console.Error.WriteLine("Folosire: seed-foods --as adresa@exemplu.ro");
                    return 1;
                }
                var users = services.GetRequiredService<UserManager<AppUser>>();
                var user = await users.FindByEmailAsync(email);
                if (user is null)
                {
                    Console.Error.WriteLine($"Nu există contul {email}.");
                    return 1;
                }
                var added = await SeedFoods.RunAsync(services.GetRequiredService<AppDbContext>(), user.Id, CancellationToken.None);
                Console.WriteLine($"Am adăugat {added} alimente.");
                return 0;
            }
        }
        return 1;
    }

    static Dictionary<string, string> ParseOptions(string[] args)
    {
        var options = new Dictionary<string, string>();
        for (var i = 0; i < args.Length - 1; i++)
            if (args[i].StartsWith("--"))
                options[args[i][2..]] = args[++i];
        return options;
    }

    static string ReadPassword()
    {
        if (Console.IsInputRedirected)
            return Console.ReadLine() ?? "";

        Console.Write("Parola (minim 10 caractere): ");
        var password = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
                break;
            if (key.Key == ConsoleKey.Backspace && password.Length > 0)
                password.Length--;
            else if (!char.IsControl(key.KeyChar))
                password.Append(key.KeyChar);
        }
        Console.WriteLine();
        return password.ToString();
    }
}

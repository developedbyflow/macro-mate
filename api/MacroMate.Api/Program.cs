using System.Reflection;
using System.Text.Json.Serialization;
using MacroMate.Api.Admin;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Ai;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Foods;
using MacroMate.Api.Features.Kitchens;
using MacroMate.Api.Features.Photos;
using MacroMate.Api.Features.Sync;
using MacroMate.Api.Features.Email;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.Configure<DeepSeekOptions>(builder.Configuration.GetSection("DeepSeek"));
builder.Services.Configure<DevSeedOptions>(builder.Configuration.GetSection("DevSeed"));
var storage = builder.Configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();

builder.Services.AddDbContext<AppDbContext>(o => o
    .UseNpgsql(builder.Configuration.GetConnectionString("Default"))
    .UseSnakeCaseNamingConvention());

builder.Services.AddDataProtection()
    .SetApplicationName("MacroMate")
    .PersistKeysToFileSystem(new DirectoryInfo(storage.KeysPath));

builder.Services.AddLocalization(o => o.ResourcesPath = "Resources");

builder.Services
    .AddIdentityCore<AppUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 10;
        o.Password.RequireDigit = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager()
    .AddErrorDescriber<LocalizedIdentityErrorDescriber>()
    .AddDefaultTokenProviders();
builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(2));

builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
if (string.IsNullOrWhiteSpace(builder.Configuration["Email:ResendApiKey"]))
    builder.Services.AddSingleton<IEmailSender, LogEmailSender>();
else
    builder.Services.AddHttpClient<IEmailSender, ResendEmailSender>(c => c.BaseAddress = new Uri("https://api.resend.com/"));

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, o =>
    {
        o.Cookie.Name = "mm_auth";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        o.ExpireTimeSpan = TimeSpan.FromDays(90);
        o.SlidingExpiration = true;
        o.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        o.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddOpenApi(o => o.AddSchemaTransformer((schema, _, _) =>
{
    if (schema.Properties is { Count: > 0 } properties)
        schema.Required = new HashSet<string>(properties.Keys);
    return Task.CompletedTask;
}));

builder.Services.AddHttpClient<OpenFoodFactsClient>(c =>
{
    c.BaseAddress = new Uri("https://world.openfoodfacts.org/");
    c.DefaultRequestHeaders.UserAgent.ParseAdd(builder.Configuration["OpenFoodFacts:UserAgent"] ?? "MacroMate/1.0");
    c.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient<DeepSeekClient>((services, c) =>
{
    var options = builder.Configuration.GetSection("DeepSeek").Get<DeepSeekOptions>() ?? new DeepSeekOptions();
    c.BaseAddress = new Uri(options.BaseUrl);
    c.Timeout = TimeSpan.FromSeconds(120);
});

var app = builder.Build();

var isBuildTimeOpenApi = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
if (!isBuildTimeOpenApi)
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    if (app.Environment.IsDevelopment())
        await DevSeed.RunAsync(scope.ServiceProvider, builder.Configuration.GetSection("DevSeed").Get<DevSeedOptions>() ?? new(), CancellationToken.None);
}

if (AdminCommands.IsCommand(args))
    return await AdminCommands.RunAsync(app, args);

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRequestLocalization(o =>
{
    string[] cultures = ["ro", "en"];
    o.SetDefaultCulture("ro").AddSupportedCultures(cultures).AddSupportedUICultures(cultures);
    o.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapKitchenEndpoints();
app.MapSyncEndpoints();
app.MapBarcodeEndpoints();
app.MapAiEndpoints();
app.MapPhotoEndpoints();

await app.RunAsync();
return 0;

public partial class Program;

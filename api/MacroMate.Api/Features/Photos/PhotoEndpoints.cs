using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace MacroMate.Api.Features.Photos;

public sealed class StorageOptions
{
    public string Path { get; set; } = "storage";
    public string PhotosPath => System.IO.Path.Combine(Path, "photos");
    public string KeysPath => System.IO.Path.Combine(Path, "keys");
}

public static class PhotoEndpoints
{
    const long MaxBytes = 8 * 1024 * 1024;
    static readonly string[] AllowedTypes = ["image/jpeg"];

    public static void MapPhotoEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/photos").RequireAuthorization();
        group.MapPut("/{id:guid}", Upload);
        group.MapGet("/{id:guid}", Download);
    }

    static async Task<IResult> Upload(Guid id, HttpRequest request, IOptions<StorageOptions> storage, CancellationToken ct)
    {
        if (!AllowedTypes.Contains(request.ContentType))
            return Results.Problem("Poza trebuie să fie JPEG.", statusCode: StatusCodes.Status415UnsupportedMediaType);
        if (request.ContentLength is null or > MaxBytes)
            return Results.Problem("Poza trebuie să aibă sub 8 MB.", statusCode: StatusCodes.Status413PayloadTooLarge);

        Directory.CreateDirectory(storage.Value.PhotosPath);
        var path = PhotoPath(storage.Value, id);
        if (File.Exists(path))
            return Results.NoContent();

        var temp = path + ".tmp";
        await using (var file = File.Create(temp))
            await request.Body.CopyToAsync(file, ct);
        File.Move(temp, path, overwrite: true);
        return Results.NoContent();
    }

    static IResult Download(Guid id, HttpResponse response, IOptions<StorageOptions> storage)
    {
        var path = PhotoPath(storage.Value, id);
        if (!File.Exists(path))
            return Results.NotFound();

        response.Headers[HeaderNames.CacheControl] = "private, max-age=31536000, immutable";
        return Results.File(Path.GetFullPath(path), "image/jpeg");
    }

    static string PhotoPath(StorageOptions storage, Guid id) => Path.Combine(storage.PhotosPath, $"{id:N}.jpg");
}

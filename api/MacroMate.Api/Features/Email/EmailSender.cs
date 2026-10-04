using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Email;

public sealed record EmailMessage(string To, string Subject, string Text);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

public sealed class EmailOptions
{
    public string From { get; set; } = "";
    public string ResendApiKey { get; set; } = "";
    public string PublicUrl { get; set; } = "";
}

public sealed class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        logger.LogWarning("Email to {To}: {Subject}{NewLine}{Text}", message.To, message.Subject, Environment.NewLine, message.Text);
        return Task.CompletedTask;
    }
}

public sealed class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "emails")
        {
            Content = JsonContent.Create(new { from = options.Value.From, to = new[] { message.To }, subject = message.Subject, text = message.Text }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ResendApiKey);
        using var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }
}

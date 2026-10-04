using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Auth;

public sealed class LocalizedIdentityErrorDescriber(IStringLocalizer<Messages> messages) : IdentityErrorDescriber
{
    public override IdentityError PasswordTooShort(int length) =>
        Error(nameof(PasswordTooShort), messages["PasswordTooShort", length]);

    public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) =>
        Error(nameof(PasswordRequiresUniqueChars), messages["PasswordRequiresUniqueChars", uniqueChars]);

    public override IdentityError InvalidEmail(string? email) => Error(nameof(InvalidEmail), messages["InvalidEmail"]);

    public override IdentityError InvalidUserName(string? userName) => Error(nameof(InvalidUserName), messages["InvalidEmail"]);

    public override IdentityError DuplicateEmail(string email) => Error(nameof(DuplicateEmail), messages["DuplicateEmail"]);

    public override IdentityError DuplicateUserName(string userName) => Error(nameof(DuplicateUserName), messages["DuplicateEmail"]);

    public override IdentityError PasswordMismatch() => Error(nameof(PasswordMismatch), messages["WrongCurrentPassword"]);

    public override IdentityError InvalidToken() => Error(nameof(InvalidToken), messages["InvalidLink"]);

    static IdentityError Error(string code, string description) => new() { Code = code, Description = description };
}

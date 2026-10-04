namespace MacroMate.Api.Data;

public static class FoodCategories
{
    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        ["vegetables"] = "legume",
        ["starchy_vegetables"] = "legume cu amidon",
        ["fruits"] = "fructe",
        ["berries"] = "fructe de pădure",
        ["poultry"] = "carne albă",
        ["red_meat"] = "carne roșie",
        ["cured_meats"] = "mezeluri",
        ["fish_seafood"] = "pește și fructe de mare",
        ["eggs"] = "ouă",
        ["dairy"] = "lactate",
        ["cheese"] = "brânzeturi",
        ["grains_pasta"] = "cereale și paste",
        ["bread_bakery"] = "pâine și panificație",
        ["legumes"] = "leguminoase",
        ["nuts_seeds"] = "nuci și semințe",
        ["oils_fats"] = "uleiuri și grăsimi",
        ["sauces_condiments"] = "sosuri și condimente",
        ["sweets"] = "dulciuri",
        ["drinks"] = "băuturi",
    };

    public static bool IsValid(string code) => Labels.ContainsKey(code);
}

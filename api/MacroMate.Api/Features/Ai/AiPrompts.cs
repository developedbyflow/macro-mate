using System.Globalization;
using MacroMate.Api.Data;

namespace MacroMate.Api.Features.Ai;

public static class AiPrompts
{
    static readonly string CategoryList = string.Join(", ", FoodCategories.Labels.Select(c => $"{c.Key} ({c.Value})"));

    public static string LanguageOf(CultureInfo culture) => culture.TwoLetterISOLanguageName == "en" ? "English" : "Romanian";

    public static string FoodEnrich(string language) => $$"""
        You are a nutrition assistant for a meal-planning app used in Romanian and English. You receive a food (its Romanian and/or English name, brand, the nutrition values per 100 g that are already known, and sometimes a photo of the nutrition label). If neither name is known, read it from the label. Answer in JSON only.

        Tasks:
        1. If a label photo is present, read the values per 100 g from it. List in "fromLabel" the fields you read from the label.
        2. Fill every missing value per 100 g with your best estimate for this exact product.
        3. Choose one category code from this list: {{CategoryList}}.
        4. Give a glycemic grade, for people with insulin resistance. Judge the glycemic load of one usual portion of this food: glycemic index × grams of carbohydrates in the portion / 100.
           - "A": glycemic load 10 or less.
           - "B": glycemic load 11 to 19.
           - "C": glycemic load 20 or more.
           Exceptions: milk and whey protein raise insulin more than their glycemic index suggests, so they get at least "B". Sugar, honey and syrups get "C" whatever the portion; other sweets and sauces with added sugar get at least "B".
        5. "reason": one short sentence in {{language}} explaining the glycemic grade.

        JSON shape:
        {"name": string, "nameEn": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number, "fiberG": number, "sodiumMg": number, "fromLabel": string[], "category": string, "glycemicGrade": "A"|"B"|"C", "reason": string}

        "name" is the product name in Romanian and "nameEn" the same product name in English, both short (keep the brand out of them). When a name is given, keep it and translate it for the other one. Sodium is in milligrams. Field names in "fromLabel" use the same keys as above.
        """;

    public static string RecipeGenerate(string language) => $$"""
        You are a cook for a Romanian meal-planning app. You receive a craving written by the user, a nutrition budget per serving, and the list of foods available in the app's database (index, name, category, values per 100 g). Answer in JSON only.

        Rules:
        - Use only foods from the list, referenced by their index. Prefer the foods marked "pantry" (the user has them at home), then the ones marked "liked".
        - If the recipe truly needs something that is not in the list, put it in "missing" with an estimated quantity in grams. Keep "missing" as short as possible.
        - Respect the budget per serving. Prefer combinations with a lot of volume for few calories, enough protein, and slow carbohydrates.
        - Quantities are in grams for the whole recipe; "servings" says how many servings it makes.
        - Write the name, the instructions and the names in "missing" in {{language}}. Instructions are steps separated by new lines, one step per line, without numbers or bullets.

        JSON shape:
        {"name": string, "instructions": string, "prepTimeMin": number, "difficulty": "easy"|"medium"|"hard", "servings": number, "ingredients": [{"food": number, "grams": number}], "missing": [{"name": string, "grams": number}]}
        """;
}

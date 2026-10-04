using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFoodReasonEn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "grades_reason_en",
                table: "foods",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE foods f
                SET grades_reason_en = v.reason_en, version = nextval('sync_version'), updated_at = now()
                FROM (VALUES
                    ('Roșii', 'Very few calories for a lot of volume, and few carbohydrates.'),
                    ('Castravete', 'Almost all water: a lot of volume for very few calories.'),
                    ('Ardei gras roșu', 'Few calories, good fiber, carbohydrates that raise blood sugar slowly.'),
                    ('Broccoli', 'A lot of volume, fiber and protein for very few calories.'),
                    ('Spanac', 'Very few calories and almost no carbohydrates.'),
                    ('Salată verde', 'A great deal of volume for almost zero calories.'),
                    ('Ceapă', 'Few calories, slow carbohydrates.'),
                    ('Usturoi', 'Many calories per 100 g, but it is used in very small amounts.'),
                    ('Morcovi', 'Few calories and good fiber; raw, they raise blood sugar slowly.'),
                    ('Dovlecel', 'A lot of volume for very few calories.'),
                    ('Varză albă', 'Plenty of fiber and very few calories.'),
                    ('Ciuperci champignon', 'Very few calories and almost no carbohydrates.'),
                    ('Conopidă', 'A lot of volume, few calories, few carbohydrates.'),
                    ('Cartofi', 'Few calories for the volume, but the starch raises blood sugar quickly.'),
                    ('Cartofi dulci', 'More fiber than white potatoes; medium effect on blood sugar.'),
                    ('Porumb dulce', 'Starch with a medium effect on blood sugar.'),
                    ('Mazăre verde', 'Plenty of fiber and protein, slow carbohydrates.'),
                    ('Măr', 'Plenty of fiber and water; the sugar in apples raises blood sugar slowly.'),
                    ('Banană', 'More sugar than other fruit; medium effect on blood sugar, higher when ripe.'),
                    ('Portocală', 'Few calories, fiber, low effect on blood sugar.'),
                    ('Pară', 'Plenty of fiber, low effect on blood sugar.'),
                    ('Kiwi', 'Good fiber and a low effect on blood sugar.'),
                    ('Struguri', 'A lot of sugar and little fiber; easy to eat too many.'),
                    ('Lămâie', 'Very little sugar; used for flavor.'),
                    ('Căpșuni', 'Very few calories and little sugar for a fruit.'),
                    ('Zmeură', 'A lot of fiber for a fruit, low effect on blood sugar.'),
                    ('Afine', 'Few calories and a low effect on blood sugar.'),
                    ('Mure', 'Plenty of fiber, little sugar.'),
                    ('Piept de pui', 'A lot of protein for few calories, no carbohydrates.'),
                    ('Pulpe de pui dezosate, fără piele', 'A lot of protein, a little more fat than the breast.'),
                    ('Piept de curcan', 'One of the leanest sources of protein.'),
                    ('Carne tocată de vită 5%', 'Good protein, moderate fat.'),
                    ('Mușchiuleț de porc', 'The lean part of the pig: a lot of protein, little fat.'),
                    ('Șuncă de curcan feliată', 'Good protein, but a lot of salt.'),
                    ('Bacon', 'Almost only fat and salt.'),
                    ('Somon', 'Protein and good fats, but more calories than white fish.'),
                    ('Ton în suc propriu', 'A lot of protein for few calories.'),
                    ('Cod', 'Very lean white fish: protein for very few calories.'),
                    ('Creveți', 'Almost only protein.'),
                    ('Ou întreg', 'Good protein and filling; the yolk brings the fat.'),
                    ('Albuș', 'Almost pure protein, very few calories.'),
                    ('Iaurt grecesc 2%', 'A lot of protein, few calories and little sugar.'),
                    ('Iaurt natural 3,5%', 'Few calories and little sugar.'),
                    ('Lapte 1,5%', 'Low effect on blood sugar, but milk raises insulin more than its blood sugar effect suggests.'),
                    ('Brânză de vaci 2%', 'A lot of protein for few calories.'),
                    ('Proteină din zer (whey)', 'Almost pure protein, but whey raises insulin quickly.'),
                    ('Telemea de vacă', 'No carbohydrates, but a lot of fat and salt.'),
                    ('Mozzarella', 'Good protein, but many calories from fat.'),
                    ('Parmezan', 'Very calorie-dense and salty; best in small amounts.'),
                    ('Fulgi de ovăz', 'Slow carbohydrates with fiber, but a lot of them; filling when cooked.'),
                    ('Orez alb', 'Starch that raises blood sugar quickly, with almost no fiber.'),
                    ('Orez brun', 'More fiber than white rice, but a portion still raises blood sugar a lot.'),
                    ('Paste din grâu dur', 'They raise blood sugar more slowly than white bread, but a normal portion has a lot of carbohydrates.'),
                    ('Quinoa', 'More protein and fiber than other grains; medium effect on blood sugar.'),
                    ('Bulgur', 'A lot of fiber and a low glycemic index, but a portion has plenty of carbohydrates.'),
                    ('Pâine albă', 'White flour: raises blood sugar quickly and is not very filling.'),
                    ('Pâine integrală', 'More fiber than white bread, medium effect on blood sugar.'),
                    ('Lipie de grâu', 'White flour and fat: many calories per piece, medium glycemic impact.'),
                    ('Linte roșie', 'Plenty of protein and fiber; very slow carbohydrates.'),
                    ('Năut din conservă', 'Plenty of fiber and a low effect on blood sugar; filling.'),
                    ('Fasole roșie din conservă', 'Plenty of fiber and protein, low effect on blood sugar.'),
                    ('Migdale', 'Good fats, but a great many calories in a handful.'),
                    ('Nuci', 'Good fats, but very calorie-dense.'),
                    ('Unt de arahide', 'Very calorie-dense; easy to use too much.'),
                    ('Semințe de chia', 'A lot of fiber, but many calories per 100 g.'),
                    ('Ulei de măsline', 'Pure fat: one tablespoon has 90 kcal.'),
                    ('Unt', 'Almost only fat.'),
                    ('Passata de roșii', 'A sauce base with very few calories.'),
                    ('Muștar', 'Few calories per serving, but a lot of salt.'),
                    ('Ketchup', 'Added sugar and a lot of salt, but it is used in small amounts.'),
                    ('Ciocolată neagră 70%', 'Less sugar than milk chocolate, but very calorie-dense.'),
                    ('Miere', 'Almost pure sugar.'),
                    ('Zahăr', 'Pure sugar; raises blood sugar quickly.'),
                    ('Cafea neagră', 'No calories, no sugar.'),
                    ('Băutură de migdale neîndulcită', 'Very few calories and no sugar.')
                ) AS v(name, reason_en)
                WHERE f.source = 'generic' AND f.name = v.name AND f.grades_reason_en IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "grades_reason_en",
                table: "foods");
        }
    }
}

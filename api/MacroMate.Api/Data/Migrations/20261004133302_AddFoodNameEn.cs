using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFoodNameEn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "name_en",
                table: "foods",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE foods f
                SET name_en = v.name_en, version = nextval('sync_version'), updated_at = now()
                FROM (VALUES
                    ('Roșii', 'Tomatoes'),
                    ('Castravete', 'Cucumber'),
                    ('Ardei gras roșu', 'Red bell pepper'),
                    ('Broccoli', 'Broccoli'),
                    ('Spanac', 'Spinach'),
                    ('Salată verde', 'Lettuce'),
                    ('Ceapă', 'Onion'),
                    ('Usturoi', 'Garlic'),
                    ('Morcovi', 'Carrots'),
                    ('Dovlecel', 'Zucchini'),
                    ('Varză albă', 'White cabbage'),
                    ('Ciuperci champignon', 'Button mushrooms'),
                    ('Conopidă', 'Cauliflower'),
                    ('Cartofi', 'Potatoes'),
                    ('Cartofi dulci', 'Sweet potatoes'),
                    ('Porumb dulce', 'Sweet corn'),
                    ('Mazăre verde', 'Green peas'),
                    ('Măr', 'Apple'),
                    ('Banană', 'Banana'),
                    ('Portocală', 'Orange'),
                    ('Pară', 'Pear'),
                    ('Kiwi', 'Kiwi'),
                    ('Struguri', 'Grapes'),
                    ('Lămâie', 'Lemon'),
                    ('Căpșuni', 'Strawberries'),
                    ('Zmeură', 'Raspberries'),
                    ('Afine', 'Blueberries'),
                    ('Mure', 'Blackberries'),
                    ('Piept de pui', 'Chicken breast'),
                    ('Pulpe de pui dezosate, fără piele', 'Boneless skinless chicken thighs'),
                    ('Piept de curcan', 'Turkey breast'),
                    ('Carne tocată de vită 5%', 'Lean ground beef 5%'),
                    ('Mușchiuleț de porc', 'Pork tenderloin'),
                    ('Șuncă de curcan feliată', 'Sliced turkey ham'),
                    ('Bacon', 'Bacon'),
                    ('Somon', 'Salmon'),
                    ('Ton în suc propriu', 'Tuna in water'),
                    ('Cod', 'Cod'),
                    ('Creveți', 'Shrimp'),
                    ('Ou întreg', 'Whole egg'),
                    ('Albuș', 'Egg white'),
                    ('Iaurt grecesc 2%', 'Greek yogurt 2%'),
                    ('Iaurt natural 3,5%', 'Plain yogurt 3.5%'),
                    ('Lapte 1,5%', 'Milk 1.5%'),
                    ('Brânză de vaci 2%', 'Cottage cheese 2%'),
                    ('Proteină din zer (whey)', 'Whey protein'),
                    ('Telemea de vacă', 'Telemea cheese (cow’s milk)'),
                    ('Mozzarella', 'Mozzarella'),
                    ('Parmezan', 'Parmesan'),
                    ('Fulgi de ovăz', 'Rolled oats'),
                    ('Orez alb', 'White rice'),
                    ('Orez brun', 'Brown rice'),
                    ('Paste din grâu dur', 'Durum wheat pasta'),
                    ('Quinoa', 'Quinoa'),
                    ('Bulgur', 'Bulgur'),
                    ('Pâine albă', 'White bread'),
                    ('Pâine integrală', 'Whole wheat bread'),
                    ('Lipie de grâu', 'Wheat tortilla'),
                    ('Linte roșie', 'Red lentils'),
                    ('Năut din conservă', 'Canned chickpeas'),
                    ('Fasole roșie din conservă', 'Canned red kidney beans'),
                    ('Migdale', 'Almonds'),
                    ('Nuci', 'Walnuts'),
                    ('Unt de arahide', 'Peanut butter'),
                    ('Semințe de chia', 'Chia seeds'),
                    ('Ulei de măsline', 'Olive oil'),
                    ('Unt', 'Butter'),
                    ('Passata de roșii', 'Tomato passata'),
                    ('Muștar', 'Mustard'),
                    ('Ketchup', 'Ketchup'),
                    ('Ciocolată neagră 70%', 'Dark chocolate 70%'),
                    ('Miere', 'Honey'),
                    ('Zahăr', 'Sugar'),
                    ('Cafea neagră', 'Black coffee'),
                    ('Băutură de migdale neîndulcită', 'Unsweetened almond milk')
                ) AS v(name, name_en)
                WHERE f.source = 'generic' AND f.name = v.name AND f.name_en IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "name_en",
                table: "foods");
        }
    }
}

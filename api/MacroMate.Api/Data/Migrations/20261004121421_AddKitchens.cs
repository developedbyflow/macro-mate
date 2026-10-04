using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKitchens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "archive_kitchen_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "shopping_lists",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "recipes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "recipe_variants",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "meal_plans",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "kitchen_invites",
                columns: table => new
                {
                    token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    kitchen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    used_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_kitchen_invites", x => x.token);
                });

            migrationBuilder.CreateTable(
                name: "kitchens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_kitchens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pantry_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    food_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    kitchen_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pantry_items", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_kitchen_id",
                table: "users",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_shopping_lists_kitchen_id",
                table: "shopping_lists",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipes_kitchen_id",
                table: "recipes",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_variants_kitchen_id",
                table: "recipe_variants",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_meal_plans_kitchen_id",
                table: "meal_plans",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_kitchen_invites_kitchen_id",
                table: "kitchen_invites",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_pantry_items_kitchen_id_food_id",
                table: "pantry_items",
                columns: new[] { "kitchen_id", "food_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pantry_items_version",
                table: "pantry_items",
                column: "version");

            migrationBuilder.Sql("""
                INSERT INTO kitchens (id, created_at) SELECT id, now() FROM users;
                UPDATE users SET kitchen_id = id;

                UPDATE recipes r SET kitchen_id = u.kitchen_id, version = nextval('sync_version') FROM users u WHERE u.id = r.created_by;
                UPDATE recipe_variants v SET kitchen_id = u.kitchen_id, version = nextval('sync_version') FROM users u WHERE u.id = v.created_by;
                UPDATE meal_plans p SET kitchen_id = u.kitchen_id, version = nextval('sync_version') FROM users u WHERE u.id = p.created_by;
                UPDATE shopping_lists s SET kitchen_id = u.kitchen_id, version = nextval('sync_version') FROM users u WHERE u.id = s.created_by;

                INSERT INTO pantry_items (id, kitchen_id, food_id, created_by, created_at, updated_at, deleted_at, version)
                SELECT DISTINCT ON (u.kitchen_id, f.food_id)
                    substr(encode(sha256(convert_to(u.kitchen_id::text || ':' || f.food_id::text, 'UTF8')), 'hex'), 1, 32)::uuid,
                    u.kitchen_id, f.food_id, p.user_id, now(), now(), NULL, nextval('sync_version')
                FROM user_profiles p
                JOIN users u ON u.id = p.user_id
                CROSS JOIN LATERAL unnest(p.favorite_food_ids) AS f(food_id);
                """);

            migrationBuilder.DropColumn(
                name: "favorite_food_ids",
                table: "user_profiles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kitchen_invites");

            migrationBuilder.DropTable(
                name: "kitchens");

            migrationBuilder.DropTable(
                name: "pantry_items");

            migrationBuilder.DropIndex(
                name: "ix_users_kitchen_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "ix_shopping_lists_kitchen_id",
                table: "shopping_lists");

            migrationBuilder.DropIndex(
                name: "ix_recipes_kitchen_id",
                table: "recipes");

            migrationBuilder.DropIndex(
                name: "ix_recipe_variants_kitchen_id",
                table: "recipe_variants");

            migrationBuilder.DropIndex(
                name: "ix_meal_plans_kitchen_id",
                table: "meal_plans");

            migrationBuilder.DropColumn(
                name: "archive_kitchen_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "shopping_lists");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "recipes");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "recipe_variants");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "meal_plans");

            migrationBuilder.AddColumn<List<Guid>>(
                name: "favorite_food_ids",
                table: "user_profiles",
                type: "uuid[]",
                nullable: false);
        }
    }
}

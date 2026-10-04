using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsAndRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "demo_expires_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_demo",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "kitchen_id",
                table: "foods",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ai_usage",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_usage", x => new { x.user_id, x.day });
                });

            migrationBuilder.CreateTable(
                name: "food_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    food_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_reports", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_foods_kitchen_id",
                table: "foods",
                column: "kitchen_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_reports_food_id",
                table: "food_reports",
                column: "food_id");

            migrationBuilder.CreateIndex(
                name: "ix_food_reports_resolved_at",
                table: "food_reports",
                column: "resolved_at");

            migrationBuilder.Sql("UPDATE users SET email_confirmed = true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_usage");

            migrationBuilder.DropTable(
                name: "food_reports");

            migrationBuilder.DropIndex(
                name: "ix_foods_kitchen_id",
                table: "foods");

            migrationBuilder.DropColumn(
                name: "demo_expires_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_demo",
                table: "users");

            migrationBuilder.DropColumn(
                name: "kitchen_id",
                table: "foods");
        }
    }
}

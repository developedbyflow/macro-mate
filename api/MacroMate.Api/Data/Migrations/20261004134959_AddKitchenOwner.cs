using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKitchenOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "owner_id",
                table: "kitchens",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE kitchens k
                SET owner_id = COALESCE(
                    (SELECT u.id FROM users u WHERE u.id = k.id AND u.kitchen_id = k.id),
                    (SELECT u.id FROM users u WHERE u.kitchen_id = k.id ORDER BY u.id LIMIT 1),
                    (SELECT u.id FROM users u WHERE u.archive_kitchen_id = k.id LIMIT 1));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "owner_id",
                table: "kitchens");
        }
    }
}

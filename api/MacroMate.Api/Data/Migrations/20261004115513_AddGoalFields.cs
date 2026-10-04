using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "goal_start_date",
                table: "user_profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "goal_start_weight_kg",
                table: "user_profiles",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "goal_weight_kg",
                table: "user_profiles",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "weekly_rate_kg",
                table: "user_profiles",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "goal_start_date",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "goal_start_weight_kg",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "goal_weight_kg",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "weekly_rate_kg",
                table: "user_profiles");
        }
    }
}

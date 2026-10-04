using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class GlycemicAndWeightLossGrades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "insulin_grade",
                table: "foods",
                newName: "glycemic_grade");

            migrationBuilder.RenameColumn(
                name: "scores_reason",
                table: "foods",
                newName: "grades_reason");

            migrationBuilder.AddColumn<string>(
                name: "weight_loss_grade",
                table: "foods",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE foods SET
                    weight_loss_grade = CASE
                        WHEN weight_loss_score >= 7 THEN 'A'
                        WHEN weight_loss_score >= 4 THEN 'B'
                        WHEN weight_loss_score IS NOT NULL THEN 'C'
                    END,
                    version = nextval('sync_version');
                """);

            migrationBuilder.DropColumn(
                name: "weight_loss_score",
                table: "foods");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "weight_loss_score",
                table: "foods",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE foods SET
                    weight_loss_score = CASE weight_loss_grade WHEN 'A' THEN 8 WHEN 'B' THEN 5 WHEN 'C' THEN 2 END,
                    version = nextval('sync_version');
                """);

            migrationBuilder.DropColumn(
                name: "weight_loss_grade",
                table: "foods");

            migrationBuilder.RenameColumn(
                name: "grades_reason",
                table: "foods",
                newName: "scores_reason");

            migrationBuilder.RenameColumn(
                name: "glycemic_grade",
                table: "foods",
                newName: "insulin_grade");
        }
    }
}

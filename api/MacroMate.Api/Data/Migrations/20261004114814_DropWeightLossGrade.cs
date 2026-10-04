using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MacroMate.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropWeightLossGrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "weight_loss_grade",
                table: "foods");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "weight_loss_grade",
                table: "foods",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);
        }
    }
}

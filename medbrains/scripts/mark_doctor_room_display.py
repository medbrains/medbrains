"""Record what the doctor-room door display actually delivers.

Rows 29-38 of the TV sheet. Marked from the shipped screen, not from intent:
the current token, "Please Enter" and the next three tokens are on the door;
the patient's name is deliberately withheld, and audio, recall/skip/hold and
the break indicator are not built.
"""

import openpyxl

WORKBOOK = "MedBrains_Features.xlsx"
SHEET = "TV Displays & Queue"

# row -> (status, why)
OUTCOMES = {
    29: ("Done", "Door display ships: current token, room, next three tokens."),
    30: (
        "Partial",
        "Token and 'Please Enter' shown; patient name withheld -- a corridor is "
        "public and the OPD surface is declared token_only_public.",
    ),
    31: ("Done", "Next three waiting tokens under a 'Please Wait' heading."),
    32: (
        "Partial",
        "Call Next ships on the doctor's mobile queue; recall, skip, hold and "
        "transfer are not built.",
    ),
}


def main() -> None:
    workbook = openpyxl.load_workbook(WORKBOOK)
    sheet = workbook[SHEET]
    header = [cell.value for cell in sheet[1]]
    status_column = header.index("Status") + 1

    for row, (status, _why) in OUTCOMES.items():
        sheet.cell(row=row, column=status_column).value = status

    workbook.save(WORKBOOK)
    print(f"updated {len(OUTCOMES)} rows in {SHEET}")


if __name__ == "__main__":
    main()

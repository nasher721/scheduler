import pandas as pd
import json

try:
    file_path = "MASTER_NEW_CALENDAR_NICU_Staff_SCHEDULE.xlsx"
    sheet_names = pd.ExcelFile(file_path).sheet_names
    print(f"Sheets found: {sheet_names}")
    
    for sheet in sheet_names[:3]:
        print(f"\n--- Sheet: {sheet} ---")
        df = pd.read_excel(file_path, sheet_name=sheet, nrows=15)
        print(df.head(15).to_string())
except Exception as e:
    print(f"Error: {e}")

import pandas as pd
file_path = "MASTER_NEW_CALENDAR_NICU_Staff_SCHEDULE.xlsx"
df = pd.read_excel(file_path, header=None, sheet_name=0)
print(df.iloc[0].values)

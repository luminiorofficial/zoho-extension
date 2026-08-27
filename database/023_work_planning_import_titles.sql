-- Preserve every explicit STOP Sub Goal title without truncation. The source
-- workbook currently contains legitimate titles longer than the original
-- manual-entry limit of 300 characters.
ALTER TABLE assignment_sub_goals
    ALTER COLUMN title TYPE TEXT;


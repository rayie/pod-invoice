
*Steps:*

1. Generate QB invoice lines as excel file and upload to google sheets
  1. Name the sheet "invoicelines"
  2. Obtain and copy the google sheet ID in the URL 
  3. SET env variable INV_SHEET_ID=[ the sheet id ]

2. Generate INV to POD tracking link and upload to google sheets
  1. Name the sheet "pods"
  2. Obtain and copy the google sheet ID in the URL 
  3. SET env variable POD_SHEET_ID=[ the sheet id ]

3. Run express to so renderUrl can read the express served invoice data
  1. npm start 

4. Parse invoce lines from (1) and store each line as a mongodb doc
  1. Clear out old batch at winwin_invs
  2. run node qb_export_to_db.js invToDb
  3. check that data/generatedinvs contains invoice pdfs just generated

5. Download the PODs, convert to pdf, and merge with invoice pdf
  1. run node process_pods.js

Resulting pods should be in data/done




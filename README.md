# BROAD DIGGER

Broad Digger is a solution meant to enable Broad match type adoption.

Broad Digger targets advertisers who configure keywords with multiple match
types (BROAD and at least another) in the same account/campaign.

The goal of Brod Diger is to provide concrete evidence that among all the match
types, BROAD performs better than the others. This is done by using Google Ads
Script to extract your metrics per match type so that you can compare them.


___

## Solution technical condiguration
This paragraph aims to provide you a clear step-by-step guide to
execute Broad Digger.

The solution requires a configuration on a spreadsheet and the creation of one
custom script on Google Ads. 

### Spreadsheet
Please make a copy of [this spreadsheet](https://docs.google.com/spreadsheets/d/1FZYfXjuk_QjGtYts--xnGQEWZ0WWTGBmrW9xvOw4seA).

Be sure to grant access to your copy of the spreadsheet to the person 
that will execute the script.

In order to configure it you need to set the following parameters:
- *Start date*: the start date of the period you want to analyze.
The start date is included in your time frame.
- *End date*: the end date of the period you want to analyze. The start date is
included in your time frame.
- *Goal*: if you want to run the solution to analyze the Match Type data or
Search Term Data
- *Keywords*: **NOT REQUIRED FOR THE MATCH TYPE ANALYSIS** The subset of
keywords that you want to analyze. My suggestion is to extract the keywords
from the Match Type analysis and focus on the most interesting subset.
For this solution you will insert the keywords in column B, 1 keyword per row.


### Google Ads
Please copy the scripts from this repository and create a new custom script on 
Google Ads with it.

While it is not strictly necessary to have the same number of files or maintain
the same name, we think that splitting the code in different files according to
what each does helps to better understand errors and makes maintenance easier.

In the code (file code.js), it is required to change the value of the
spreadsheet url copied in the previous step.
&nbsp;&nbsp;&nbsp;&nbsp;*SPREADSHEET_URL : "YOUR_SPREADSHEET_URL"*

[IMPORTANT] Open the spreadhseet now and share it with the user that created
the script on G0ogle Ads.

___


## Execution of the solution
The solution is based on Google Ads Script and it is meant to be run in 2 parts:

**Match Type**: The solution will extract, for current account and (if any)
sub accounts, all of the keywords that have Broad match type and AT LEAST
another match type.
For those keywords, the solution will extract the following metrics:
- Cost
- Clicks
- Impressions
- Conversion Value
- Conversions

This data will provide the foundation for the deep dive analysis of the
performance of Broad match with respect to the other match types.


**Search Term**: In this phase the solution will extract, for the selected
subset of keywords, all of the Search Terms that triggered those keywords.
This level of detail will then be used to prove to customers that the Broad
match approach triggers more and more relevant impressions.


Once you have filled the start and end date fields and selected “Match type”
in the spreadsheet configuration tab , click “preview” on the Google Ads script
that you have created. It may ask you to authorize it if so, do it and click
again on "preview".

After the script concludes its execution on Google Ads, you have to:
1. Analyze the resulting keywords and select those that you want to investigate
2. Copy those keywords into the configuration tab in the spreadsheet.
3. Please put one keyword per row in column B, starting from row 4
4. Select “Search Term” in the spreadsheet configuration tab
5. Go back to the script in Google Ads and click again on preview


You can now compare the performance of keywords with different match types

___


## Disclaimers

**This is not an officially supported Google product.**

*Copyright 2024 Google LLC. This solution, including any related sample code or
data, is made available on an “as is,” “as available,” and “with all faults”
basis, solely for illustrative purposes, and without warranty or representation
of any kind. This solution is experimental, unsupported and provided solely for
your convenience. Your use of it is subject to your agreements with Google, as
applicable, and may constitute a beta feature as defined under those agreements.
To the extent that you make any data available to Google in connection with your
use of the solution, you represent and warrant that you have all necessary and
appropriate rights, consents and permissions to permit Google to use and process
that data. By using any portion of this solution, you acknowledge, assume and
accept all risks, known and unknown, associated with its usage, including with
respect to your deployment of any portion of this solution in your systems, or
usage in connection with your business, if at all.*

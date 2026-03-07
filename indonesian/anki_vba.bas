Attribute VB_Name = "modAnki"

Option Explicit

' =============================================================================
'  BAHASA INDONESIA / MALAY — SPACED REPETITION FLASHCARD ENGINE
'  SM-2 Algorithm  |  Damayanti (Indonesian) TTS  |  xlsm module
' =============================================================================

' Sheet / column constants
Const VOCAB_SH  As String = "Vocab"
Const SRS_SH    As String = "SRS_Data"
Const CARD_SH   As String = "Flashcard"

Const C_NUM  As Integer = 1
Const C_INDO As Integer = 2
Const C_MALY As Integer = 3
Const C_ENG  As Integer = 4
Const C_CAT  As Integer = 5
Const C_CTH  As Integer = 6
Const C_EEX  As Integer = 7
Const C_INT  As Integer = 8
Const C_EF   As Integer = 9
Const C_NXT  As Integer = 10
Const C_REP  As Integer = 11
Const C_COR  As Integer = 12
Const C_WRG  As Integer = 13

' Session state
Dim mQueue()    As Long
Dim mQSize      As Long
Dim mQPos       As Long
Dim mCurRow     As Long
Dim mSessCor    As Long
Dim mSessWrg    As Long
Dim mAnswerVis  As Boolean
Dim mMode       As String    ' "ID_EN" or "EN_ID"
Dim mCategory   As String

' =============================================================================
'  BUTTON SETUP  — run once to wire up clickable shapes
' =============================================================================
Sub SetupButtons()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)

    ' Remove old shapes
    Dim shp As Shape
    For Each shp In ws.Shapes
        shp.Delete
    Next shp

    ' Helper: add a rounded rectangle button
    ' AddBtn(name, macro, row1, col1, row2, col2, fillHex, textHex, label)
    Call AddBtn(ws, "btnStart",  "BtnStart",  22, 3, 22, 4, "1ABC9C", "FFFFFF", Chr(9654) & "  START / RESTART")
    Call AddBtn(ws, "btnStats",  "BtnStats",  22, 5, 22, 6, "8E44AD", "FFFFFF", Chr(128202) & "  Stats")
    Call AddBtn(ws, "btnSetup",  "BtnSetup",  22, 7, 22, 8, "7F8C8D", "FFFFFF", Chr(9881) & "  Setup")

    Call AddBtn(ws, "btnShow",   "BtnShow",   19, 3, 19, 8, "E8732A", "FFFFFF", Chr(128065) & "  Show Answer")
    Call AddBtn(ws, "btnPron",   "BtnPronounce", 20, 3, 20, 8, "D6EAF8", "1A3C5E", Chr(128266) & "  Pronounce  (Damayanti)")

    Call AddBtn(ws, "btnAgain",  "BtnAgain",  17, 3, 17, 4, "C0392B", "FFFFFF", Chr(128552) & "  Again" & Chr(10) & "(forgot)")
    Call AddBtn(ws, "btnHard",   "BtnHard",   17, 5, 17, 6, "D35400", "FFFFFF", Chr(128533) & "  Hard" & Chr(10) & "(struggled)")
    Call AddBtn(ws, "btnGood",   "BtnGood",   18, 3, 18, 4, "27AE60", "FFFFFF", Chr(128578) & "  Good" & Chr(10) & "(knew it)")
    Call AddBtn(ws, "btnEasy",   "BtnEasy",   18, 5, 18, 6, "2980B9", "FFFFFF", Chr(128516) & "  Easy" & Chr(10) & "(instant!)")

    ' Mode toggle buttons
    Call AddBtn(ws, "btnModeID", "BtnModeID", 4, 4, 4, 4, "0A5C2E", "FFFFFF", Chr(127470) & Chr(127465) & " ID" & Chr(8594) & "EN")
    Call AddBtn(ws, "btnModeEN", "BtnModeEN", 4, 5, 4, 5, "3A2A6E", "FFFFFF", Chr(127468) & Chr(127463) & " EN" & Chr(8594) & "ID")

    ' Hide rating buttons initially
    SetRatingVisible ws, False
    ws.Shapes("btnShow").Visible = False

    MsgBox "Buttons created! Click " & Chr(9654) & " START to begin.", vbInformation
End Sub

Private Sub AddBtn(ws As Worksheet, nm As String, mac As String, _
                   r1 As Long, c1 As Long, r2 As Long, c2 As Long, _
                   fillClr As String, txtClr As String, lbl As String)
    Dim t  As Double, l  As Double, w  As Double, h  As Double
    Dim rng As Range
    Set rng = ws.Range(ws.Cells(r1, c1), ws.Cells(r2, c2))
    t = rng.Top + 3
    l = rng.Left + 3
    w = rng.Width - 6
    h = rng.Height - 6

    Dim shp As Shape
    Set shp = ws.Shapes.AddShape(msoShapeRoundedRectangle, l, t, w, h)
    shp.Name = nm
    shp.OnAction = mac

    With shp.Fill
        .Visible = msoTrue
        .ForeColor.RGB = RGB(CInt("&H" & Left(fillClr, 2)), _
                             CInt("&H" & Mid(fillClr, 3, 2)), _
                             CInt("&H" & Right(fillClr, 2)))
        .Transparency = 0
    End With
    With shp.Line
        .Visible = msoFalse
    End With
    With shp.TextFrame2
        .TextRange.Text = lbl
        .TextRange.Font.Name = "Calibri"
        .TextRange.Font.Bold = msoTrue
        .TextRange.Font.Size = 11
        .TextRange.Font.Fill.ForeColor.RGB = _
            RGB(CInt("&H" & Left(txtClr, 2)), _
                CInt("&H" & Mid(txtClr, 3, 2)), _
                CInt("&H" & Right(txtClr, 2)))
        .VerticalAnchor = msoAnchorMiddle
        .TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .WordWrap = msoTrue
    End With
    With shp.Shadow
        .Visible = msoTrue
        .OffsetX = 1
        .OffsetY = 2
        .Transparency = 0.7
        .Size = 100
        .Blur = 4
    End With
End Sub

' =============================================================================
'  SM-2 ALGORITHM
' =============================================================================
Sub ApplySM2(srsRow As Long, rating As Integer)
    Dim wsSRS As Worksheet
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    Dim interval As Double
    Dim ef       As Double
    Dim reps     As Long
    Dim grade    As Integer

    interval = Val(wsSRS.Cells(srsRow, C_INT).Value)
    ef       = Val(wsSRS.Cells(srsRow, C_EF).Value)
    reps     = CLng(wsSRS.Cells(srsRow, C_REP).Value)

    If ef < 1.3 Then ef = 2.5

    ' Map 1-4 rating → SM-2 grade 0-5
    Select Case rating
        Case 1: grade = 1   ' Again
        Case 2: grade = 3   ' Hard
        Case 3: grade = 4   ' Good
        Case 4: grade = 5   ' Easy
    End Select

    If grade < 3 Then
        reps     = 0
        interval = 1
    Else
        Select Case reps
            Case 0:    interval = 1
            Case 1:    interval = 6
            Case Else: interval = WorksheetFunction.Round(interval * ef, 0)
        End Select
        reps = reps + 1
    End If

    ' Ease factor update
    ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    If ef < 1.3 Then ef = 1.3
    If ef > 5   Then ef = 5

    wsSRS.Cells(srsRow, C_INT).Value = interval
    wsSRS.Cells(srsRow, C_EF).Value  = WorksheetFunction.Round(ef, 2)
    wsSRS.Cells(srsRow, C_NXT).Value = Now() + interval
    wsSRS.Cells(srsRow, C_REP).Value = reps

    If grade >= 3 Then
        wsSRS.Cells(srsRow, C_COR).Value = wsSRS.Cells(srsRow, C_COR).Value + 1
        mSessCor = mSessCor + 1
    Else
        wsSRS.Cells(srsRow, C_WRG).Value = wsSRS.Cells(srsRow, C_WRG).Value + 1
        mSessWrg = mSessWrg + 1
    End If
End Sub

' =============================================================================
'  BUILD QUEUE OF DUE CARDS (shuffled)
' =============================================================================
Sub BuildQueue()
    Dim wsSRS As Worksheet
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    Dim lastRow As Long
    lastRow = wsSRS.Cells(wsSRS.Rows.Count, C_NUM).End(xlUp).Row

    ' Count due cards
    Dim cnt As Long
    cnt = 0
    Dim i As Long
    For i = 2 To lastRow
        If wsSRS.Cells(i, C_NUM).Value = "" Then GoTo Skip1
        If mCategory <> "All" And wsSRS.Cells(i, C_CAT).Value <> mCategory Then GoTo Skip1
        Dim nv As Variant
        nv = wsSRS.Cells(i, C_NXT).Value
        If nv = "" Or CDate(nv) <= Now() Then cnt = cnt + 1
Skip1:
    Next i

    If cnt = 0 Then
        MsgBox "No cards due!  All " & (lastRow - 1) & " cards reviewed." & _
               Chr(10) & "Come back later, or change the category.", _
               vbInformation, Chr(127881) & " All caught up!"
        mQSize = 0
        Exit Sub
    End If

    ' Fill queue
    ReDim mQueue(1 To cnt)
    Dim q As Long
    q = 1
    For i = 2 To lastRow
        If wsSRS.Cells(i, C_NUM).Value = "" Then GoTo Skip2
        If mCategory <> "All" And wsSRS.Cells(i, C_CAT).Value <> mCategory Then GoTo Skip2
        nv = wsSRS.Cells(i, C_NXT).Value
        If nv = "" Or CDate(nv) <= Now() Then
            mQueue(q) = i
            q = q + 1
        End If
Skip2:
    Next i

    ' Fisher-Yates shuffle
    Randomize
    For i = cnt To 2 Step -1
        Dim j As Long
        j = Int(Rnd() * i) + 1
        Dim tmp As Long
        tmp = mQueue(i)
        mQueue(i) = mQueue(j)
        mQueue(j) = tmp
    Next i

    mQSize   = cnt
    mQPos    = 1
    mSessCor = 0
    mSessWrg = 0
End Sub

' =============================================================================
'  SHOW CURRENT CARD
' =============================================================================
Sub ShowCard()
    If mQSize = 0 Or mQPos > mQSize Then
        ShowSessionEnd
        Exit Sub
    End If

    Dim ws As Worksheet
    Dim wsSRS As Worksheet
    Set ws    = ThisWorkbook.Sheets(CARD_SH)
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    mCurRow    = mQueue(mQPos)
    mAnswerVis = False

    Dim indo As String: indo = wsSRS.Cells(mCurRow, C_INDO).Value
    Dim maly As String: maly = wsSRS.Cells(mCurRow, C_MALY).Value
    Dim eng  As String: eng  = wsSRS.Cells(mCurRow, C_ENG).Value
    Dim cat  As String: cat  = wsSRS.Cells(mCurRow, C_CAT).Value
    Dim intv As Double: intv = Val(wsSRS.Cells(mCurRow, C_INT).Value)

    Dim qWord As String
    Dim qLang As String
    If mMode = "EN_ID" Then
        qWord = eng
        qLang = Chr(127468) & Chr(127463) & "  English  " & Chr(8594) & "  Indonesian"
    Else
        qWord = indo
        qLang = Chr(127470) & Chr(127465) & "  Indonesian  " & Chr(8594) & "  English"
    End If

    ws.Range("D7").Value  = qLang
    ws.Range("D8").Value  = qWord
    ws.Range("D9").Value  = ""
    ws.Range("D11").Value = ""
    ws.Range("D12").Value = ""
    ws.Range("D13").Value = ""
    ws.Range("D14").Value = ""

    ' Progress
    ws.Range("D5").Value  = "Card " & mQPos & " of " & mQSize & _
                            "   " & Chr(9989) & " " & mSessCor & _
                            "   " & Chr(10060) & " " & mSessWrg

    ' Maturity badge
    If intv = 0 Then
        ws.Range("C5").Value = Chr(11088) & " New"
    ElseIf intv < 7 Then
        ws.Range("C5").Value = Chr(128260) & " Learning"
    ElseIf intv < 21 Then
        ws.Range("C5").Value = Chr(128170) & " Review"
    Else
        ws.Range("C5").Value = Chr(127807) & " Mature"
    End If

    ' Category
    ws.Range("D4").Value = cat

    SetRatingVisible ws, False
    ws.Shapes("btnShow").Visible = True
    ws.Shapes("btnPron").Visible = True
End Sub

' =============================================================================
'  SHOW ANSWER
' =============================================================================
Sub ShowAnswer()
    If mQSize = 0 Or mCurRow = 0 Then Exit Sub
    If mAnswerVis Then Exit Sub

    Dim ws As Worksheet
    Dim wsSRS As Worksheet
    Set ws    = ThisWorkbook.Sheets(CARD_SH)
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    Dim indo As String: indo = wsSRS.Cells(mCurRow, C_INDO).Value
    Dim maly As String: maly = wsSRS.Cells(mCurRow, C_MALY).Value
    Dim eng  As String: eng  = wsSRS.Cells(mCurRow, C_ENG).Value
    Dim cth  As String: cth  = wsSRS.Cells(mCurRow, C_CTH).Value
    Dim eex  As String: eex  = wsSRS.Cells(mCurRow, C_EEX).Value

    If mMode = "EN_ID" Then
        ws.Range("D11").Value = indo
        If maly <> "" And maly <> indo Then
            ws.Range("D12").Value = "Malay: " & maly
        End If
    Else
        ws.Range("D11").Value = eng
        ws.Range("D12").Value = ""
    End If

    ws.Range("D13").Value = Chr(128221) & " " & cth
    ws.Range("D14").Value = Chr(127468) & Chr(127463) & " " & eex

    mAnswerVis = True
    SetRatingVisible ws, True
    ws.Shapes("btnShow").Visible = False
End Sub

' =============================================================================
'  RATING
' =============================================================================
Sub RateCard(rating As Integer)
    If Not mAnswerVis Then
        MsgBox "Please show the answer first!", vbExclamation
        Exit Sub
    End If

    ApplySM2 mCurRow, rating

    ' If wrong, re-queue at end
    If rating = 1 Then
        mQSize = mQSize + 1
        ReDim Preserve mQueue(1 To mQSize)
        mQueue(mQSize) = mCurRow
    End If

    mQPos = mQPos + 1
    ShowCard
End Sub

Sub BtnAgain():     RateCard 1: End Sub
Sub BtnHard():      RateCard 2: End Sub
Sub BtnGood():      RateCard 3: End Sub
Sub BtnEasy():      RateCard 4: End Sub
Sub BtnShow():      ShowAnswer: End Sub

' =============================================================================
'  PRONOUNCE (macOS Damayanti voice)
' =============================================================================
Sub BtnPronounce()
    If mCurRow = 0 Or mQSize = 0 Then Exit Sub

    Dim wsSRS As Worksheet
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    Dim word As String
    If mMode = "EN_ID" Then
        word = wsSRS.Cells(mCurRow, C_ENG).Value
    Else
        word = wsSRS.Cells(mCurRow, C_INDO).Value
    End If

    ' Sanitise for shell
    word = Replace(word, "'",  "")
    word = Replace(word, """", "")
    word = Replace(word, "/",  " ")
    word = Trim(Split(word, "(")(0))

    Dim scr As String
    ' Try Damayanti (Indonesian), fall back to default
    scr = "do shell script ""say -v Damayanti '" & word & "' 2>/dev/null || say '" & word & "'"""

    On Error Resume Next
    MacScript scr
    On Error GoTo 0
End Sub

' =============================================================================
'  MODE TOGGLE
' =============================================================================
Sub BtnModeID()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)
    mMode = "ID_EN"
    ws.Range("H3").Value = "ID_EN"
    ws.Range("D7").Value = Chr(127470) & Chr(127465) & "  Indonesian  " & Chr(8594) & "  English"
    MsgBox "Mode: Indonesian " & Chr(8594) & " English", vbInformation
End Sub

Sub BtnModeEN()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)
    mMode = "EN_ID"
    ws.Range("H3").Value = "EN_ID"
    ws.Range("D7").Value = Chr(127468) & Chr(127463) & "  English  " & Chr(8594) & "  Indonesian"
    MsgBox "Mode: English " & Chr(8594) & " Indonesian", vbInformation
End Sub

' =============================================================================
'  START SESSION
' =============================================================================
Sub BtnStart()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)

    ' Read config from hidden cells
    mMode     = ws.Range("H3").Value
    mCategory = ws.Range("H4").Value
    If mMode     = "" Then mMode     = "ID_EN"
    If mCategory = "" Then mCategory = "All"

    ' Ensure SRS_Data is populated
    Dim wsSRS As Worksheet
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)
    If wsSRS.Cells(2, C_NUM).Value = "" Then
        MsgBox "SRS data is empty. Run " & Chr(9881) & " Setup first.", vbExclamation
        Exit Sub
    End If

    BuildQueue
    If mQSize = 0 Then Exit Sub

    mCurRow = 0
    ShowCard
End Sub

' =============================================================================
'  SETUP — category picker
' =============================================================================
Sub BtnSetup()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)

    Dim cats As String
    cats = "All" & Chr(10) & _
           "Pronouns & Determiners" & Chr(10) & _
           "Conjunctions & Connectors" & Chr(10) & _
           "Prepositions" & Chr(10) & _
           "Numbers & Quantities" & Chr(10) & _
           "Time & Frequency" & Chr(10) & _
           "Verbs - General" & Chr(10) & _
           "Verbs - Movement & Action" & Chr(10) & _
           "Verbs - Communication & Mind" & Chr(10) & _
           "Adjectives" & Chr(10) & _
           "Adverbs & Degree Words" & Chr(10) & _
           "Food & Drink" & Chr(10) & _
           "Family & Relationships" & Chr(10) & _
           "Body & Health" & Chr(10) & _
           "Nature & Environment" & Chr(10) & _
           "Places & Geography" & Chr(10) & _
           "Transport & Travel" & Chr(10) & _
           "Household & Objects" & Chr(10) & _
           "Technology & Media" & Chr(10) & _
           "Education & Knowledge" & Chr(10) & _
           "Business & Finance" & Chr(10) & _
           "Government, Law & Society" & Chr(10) & _
           "Work & Profession" & Chr(10) & _
           "Arts, Culture & Religion" & Chr(10) & _
           "Abstract Concepts & Values" & Chr(10) & _
           "Emotions & Personality" & Chr(10) & _
           "Expressions & Phrases" & Chr(10) & _
           "Colors" & Chr(10) & _
           "General"

    Dim inp As String
    inp = InputBox("Enter category to study (or 'All'):" & Chr(10) & Chr(10) & cats, _
                   "Choose Category", mCategory)

    If inp = "" Then Exit Sub

    mCategory = inp
    ws.Range("H4").Value = inp
    ws.Range("D4").Value = inp

    MsgBox "Category set to: " & inp & Chr(10) & "Click START to begin.", vbInformation
End Sub

' =============================================================================
'  STATS PANEL
' =============================================================================
Sub BtnStats()
    Dim wsSRS As Worksheet
    Set wsSRS = ThisWorkbook.Sheets(SRS_SH)

    Dim lastRow As Long
    lastRow = wsSRS.Cells(wsSRS.Rows.Count, C_NUM).End(xlUp).Row

    Dim total As Long, newC As Long, lrn As Long, mature As Long
    Dim dueNow As Long, totCor As Long, totWrg As Long

    Dim i As Long
    For i = 2 To lastRow
        If wsSRS.Cells(i, C_NUM).Value = "" Then GoTo SK
        total = total + 1
        totCor = totCor + CLng(wsSRS.Cells(i, C_COR).Value)
        totWrg = totWrg + CLng(wsSRS.Cells(i, C_WRG).Value)

        Dim intv2 As Double
        intv2 = Val(wsSRS.Cells(i, C_INT).Value)
        If intv2 = 0 Then
            newC = newC + 1
        ElseIf intv2 < 21 Then
            lrn = lrn + 1
        Else
            mature = mature + 1
        End If

        Dim nv2 As Variant
        nv2 = wsSRS.Cells(i, C_NXT).Value
        If nv2 = "" Or CDate(nv2) <= Now() Then dueNow = dueNow + 1
SK:
    Next i

    Dim acc As Long
    If (totCor + totWrg) > 0 Then acc = CLng(100 * totCor / (totCor + totWrg))

    MsgBox Chr(128202) & " Your Progress" & Chr(10) & Chr(10) & _
           "Total cards:          " & total & Chr(10) & _
           Chr(11088) & " New (unseen):       " & newC & Chr(10) & _
           Chr(128260) & " Learning (<21d):   " & lrn & Chr(10) & _
           Chr(127807) & " Mature (21d+):     " & mature & Chr(10) & Chr(10) & _
           Chr(128197) & " Due today:          " & dueNow & Chr(10) & Chr(10) & _
           Chr(9989) & "  Total correct:      " & totCor & Chr(10) & _
           Chr(10060) & " Total wrong:        " & totWrg & Chr(10) & _
           Chr(127919) & " Overall accuracy:  " & acc & "%" & Chr(10) & Chr(10) & _
           "Session: " & Chr(9989) & " " & mSessCor & "  " & Chr(10060) & " " & mSessWrg, _
           vbInformation, "Flashcard Stats"
End Sub

' =============================================================================
'  SESSION END
' =============================================================================
Sub ShowSessionEnd()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(CARD_SH)

    ws.Range("D7").Value  = "Session complete!"
    ws.Range("D8").Value  = Chr(127881) & " " & (mSessCor + mSessWrg) & " cards reviewed"
    ws.Range("D11").Value = Chr(9989) & " Correct: " & mSessCor & "   " & Chr(10060) & " Wrong: " & mSessWrg

    Dim acc As Long
    If (mSessCor + mSessWrg) > 0 Then
        acc = CLng(100 * mSessCor / (mSessCor + mSessWrg))
    End If
    ws.Range("D12").Value = "Accuracy: " & acc & "%  — Great work! Come back tomorrow. " & Chr(128075)
    ws.Range("D13").Value = ""
    ws.Range("D14").Value = ""
    ws.Range("C5").Value  = ""
    ws.Range("D5").Value  = "All done for now!"

    SetRatingVisible ws, False
    ws.Shapes("btnShow").Visible = False
    mQSize  = 0
    mCurRow = 0
End Sub

' =============================================================================
'  HELPER: toggle rating button visibility
' =============================================================================
Sub SetRatingVisible(ws As Worksheet, show As Boolean)
    Dim names() As String
    names = Split("btnAgain,btnHard,btnGood,btnEasy", ",")
    Dim n As Variant
    For Each n In names
        On Error Resume Next
        ws.Shapes(CStr(n)).Visible = show
        On Error GoTo 0
    Next n
End Sub

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# --------------------
# @Author: MeowKing<mr.ziqiyang@gmail.com>
# @Time: Sat Jan 14 20:49:17 2023;
# @License: MIT
# --------------------

from pathlib import Path
from datetime import date
import requests
import argparse
from argparse import RawTextHelpFormatter # multi-line helper message support
import json

QUERY_PAGE = "/graphql/"
MAX_QUESTION_TITLE_LENGTH = 20 # if the length of today's question title exceeds 20,
                               # the final title will be title[:MAX_QUESTION_TITLE_LENGTH] + "..."
RED = "#c0392b"
YELLOW = "#f39c12"
GREEN = "#27ae60"

QUERY_HEADERS_EN = {
    "Host": "leetcode.com",
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/problemset/all/",
    "Origin": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0"
}
QUERY_HEADERS_CN = {
    "Host": "leetcode.cn",
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": "application/json", "Referer": "https://leetcode.cn/problemset/all/",
    "Origin": "https://leetcode.cn",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0"
}

SUPPORTED_BARS = ["waybar"]

# error code
USERDATA_FAILURE = 1
UNHANDLED_ARGUMENTS_FAILURE = 2
UNSUPPORTED_BAR = 3

today = date.today().strftime("%Y-%m-%d");

argument_parser = argparse.ArgumentParser(description="Fetch leetcode data for displaying on bar(Waybar, etc.)", formatter_class=RawTextHelpFormatter)
argument_parser.add_argument('userSpaceName', help="Your leetcode public user info page identifier\n\
(e.g.  xxx from https://leetcode.com/xxx/ -> EN site\n\
       xxx from https://leetcode.cn/u/xxx/ -> CN site)")
argument_parser.add_argument('-z', '--use-cn', help="Whether to use CN site(defualt EN)", action='store_true')

conflict2 = argument_parser.add_mutually_exclusive_group()
conflict2.add_argument('-t', '--toggle-completion-status', help="Toggle today's question completion status", action='store_true')
conflict2.add_argument('-s', '--completion-status', help="For today's question. Either 'finished' or 'unfinished' or leave it blank(None, default)")

argument_parser.add_argument('-c', '--cache-file-path', default=f"/tmp/leetcode_status_{today}", help=f"default: /tmp/leetcode_status_{today}")
argument_parser.add_argument('-b', '--bar', default=f"waybar", help=f"Use specific bar output\n\
currently supported bars: {SUPPORTED_BARS}")

session = requests.Session()

def getUserData(lcHome: str, userSpaceName: str) -> dict:
    # solved question numbers(esay, medium and hard)
    QUERY_BODY = {"query":"\n    query userProblemsSolved($username: String!) {\n  allQuestionsCount {\n    difficulty\n    count\n  }\n  matchedUser(username: $username) {\n    problemsSolvedBeatsStats {\n      difficulty\n      percentage\n    }\n    submitStatsGlobal {\n      acSubmissionNum {\n        difficulty\n        count\n      }\n    }\n  }\n}\n    ",
                  "variables":{"username": userSpaceName}}
    response = session.post(lcHome + QUERY_PAGE, json=QUERY_BODY)
    assert(response.status_code == 200)

    json = response.json()
    json = json["data"]["matchedUser"]["submitStatsGlobal"]["acSubmissionNum"]

    try:
        return {
            "easy": json[1]["count"],
            "medium": json[2]["count"],
            "hard": json[3]["count"]
        }
    except IndexError:
        argument_parser.exit(USERDATA_FAILURE, 'Could not fetch user data. Please recheck your userSpaceName.\n')


def getTodayQuestion(lcHome: str) -> dict:
    QUERY_BODY = {"query":"\n    query questionOfToday {\n  activeDailyCodingChallengeQuestion {\n    date\n    userStatus\n    link\n    question {\n      acRate\n      difficulty\n      freqBar\n      frontendQuestionId: questionFrontendId\n      isFavor\n      paidOnly: isPaidOnly\n      status\n      title\n      titleSlug\n      hasVideoSolution\n      hasSolution\n      topicTags {\n        name\n        id\n        slug\n      }\n    }\n  }\n}\n    ","variables":{}}
    response = session.post(lcHome + QUERY_PAGE, json=QUERY_BODY)
    assert(response.status_code == 200)

    json = response.json()
    json = json["data"]["activeDailyCodingChallengeQuestion"]

    return {
        "date": json["date"],
        "title": json["question"]["title"],
        "questionId": json["question"]["frontendQuestionId"],
        "difficulty": json["question"]["difficulty"]
    }


def getUserDataCN(lcHome: str, userSpaceName: str) -> dict:
    # solved question numbers(esay, medium and hard)
    QUERY_BODY = {"query":"\n    query userQuestionProgress($userSlug: String!) {\n  userProfileUserQuestionProgress(userSlug: $userSlug) {\n    numAcceptedQuestions {\n      difficulty\n      count\n    }\n    numFailedQuestions {\n      difficulty\n      count\n    }\n    numUntouchedQuestions {\n      difficulty\n      count\n    }\n  }\n}\n    ",
                  "variables":{"userSlug": userSpaceName}}
    response = session.post(lcHome + QUERY_PAGE, json=QUERY_BODY)
    assert(response.status_code == 200)

    json = response.json()
    json = json["data"]["userProfileUserQuestionProgress"]["numAcceptedQuestions"]

    try:
        return {
            "easy": json[0]["count"],
            "medium": json[1]["count"],
            "hard": json[2]["count"]
        }
    except IndexError:
        argument_parser.exit(USERDATA_FAILURE, 'Could not fetch user data. Please recheck your userSpaceName.\n')


def getTodayQuestionCN(lcHome: str) -> dict:
    QUERY_BODY = {"query":"\n    query questionOfToday {\n  todayRecord {\n    date\n    userStatus\n    question {\n      questionId\n      frontendQuestionId: questionFrontendId\n      difficulty\n      title\n      titleCn: translatedTitle\n      titleSlug\n      paidOnly: isPaidOnly\n      freqBar\n      isFavor\n      acRate\n      status\n      solutionNum\n      hasVideoSolution\n      topicTags {\n        name\n        nameTranslated: translatedName\n        id\n      }\n      extra {\n        topCompanyTags {\n          imgUrl\n          slug\n          numSubscribed\n        }\n      }\n    }\n    lastSubmission {\n      id\n    }\n  }\n}\n    ","variables":{}}
    response = session.post(lcHome + QUERY_PAGE, json=QUERY_BODY)
    assert(response.status_code == 200)

    json = response.json()
    json = json["data"]["todayRecord"][0]

    return {
        "date": json["date"],
        "title": json["question"]["title"],
        "questionId": json["question"]["frontendQuestionId"],
        "difficulty": json["question"]["difficulty"]
    }


def main(arguments):
    bar = arguments.bar
    if bar not in SUPPORTED_BARS:
        argument_parser.exit(UNSUPPORTED_BAR, f"Currently the {arguments.bar} is not supported\nSupported bars: {SUPPORTED_BARS}\n")
    lcHome = "https://leetcode.com" # default en site
    todayQuestion = None
    userData = None
    if arguments.use_cn == True:
        lcHome = "https://leetcode.cn"
        todayQuestion = getTodayQuestionCN(lcHome)
        userData = getUserDataCN(lcHome, arguments.userSpaceName)
        session.headers.update(QUERY_HEADERS_CN)
    else:
        todayQuestion = getTodayQuestion(lcHome)
        userData = getUserData(lcHome, arguments.userSpaceName)
        session.headers.update(QUERY_HEADERS_EN)
    qTitle = todayQuestion["title"]
    qTitle = qTitle[:MAX_QUESTION_TITLE_LENGTH] + "..." if len(qTitle) > MAX_QUESTION_TITLE_LENGTH else qTitle

    file = Path(arguments.cache_file_path)
    if arguments.toggle_completion_status:
        if file.is_file():
            arguments.completion_status = "unfinished"
            file.unlink()
        else:
            arguments.completion_status = "finished"
            file.touch()

    status_color = ""
    status_icon = ""
    if arguments.completion_status == "unfinished":
        status_color = "#95a5a6" # grey
        status_icon = ""
        if not arguments.toggle_completion_status and file.is_file():
            file.unlink() # remove file
    elif arguments.completion_status == "finished":
        status_color = "#ffffff" # white
        status_icon = ""
        if not arguments.toggle_completion_status:
            file.touch()
    elif arguments.completion_status == None:
        if file.is_file():
            status_color = "#ffffff" # white
            status_icon = ""
        else:
            status_color = "#95a5a6" # grey
            status_icon = ""
    else:
        argument_parser.exit(UNHANDLED_ARGUMENTS_FAILURE, "Couldn't handle 'completion_status', please check your value\n")

    with open('leetcode_data.json', 'w') as file:
        json.dump(userData, file)

    # final output
    # error checking has been done at the beginning of the main function
    res = None

    if bar == "waybar":
        # icon font: fontawesome 6 free
        res = f'<span color="{status_color}">{status_icon} {qTitle}</span> | <span color="{GREEN}"></span> {userData["easy"]} \
<span color="{YELLOW}"></span> {userData["medium"]} <span color="{RED}"></span> {userData["hard"]}'
    # please consider make a pull request when you find your bar is not supported.

    print(res)

if __name__ == '__main__':
    arguments = argument_parser.parse_args()
    main(arguments)
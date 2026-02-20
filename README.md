# Grading Agent

This extension simplifies grading students' submissions using a [GitHub Copilot
Custom
Agent](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
in Visual Studio Code.

## Assumptions

This extension assumes:

* The workspace folder currently opened in Visual Studio Code has been
  downloaded from [Moodle](https://moodle.org) and contains students'
  [assignment
  submissions](https://docs.moodle.org/501/en/Using_Assignment#Downloading_student_submissions).

* That folder has a subfolder for each student submission. Each subfolder name
  includes student name, student id, and ends with the suffix
  `_assignsubmission_onlinetext`; and includes a file `onlinetext.html` with the
  text submitted by the student.

* The assignment in Moodle has been configured to accept online text only. The
  student submits a link to a repository containing the solution to the
  assigment.

* Teacher already has an `.agent.md` file with the GitHub Copilot Custom Agent
  for grading students' submissions. This extension will copy the file in the
  appropriate location, ready to be used by grading command. See [Grading Agent
  Example](#grading-agent-example) below.

* The provided grading agent creates a `.md` file in each student submission
  folder with the feedback or rationale behind the grade. This extension can
  delete those files and file names can be configured.

* The provided grading agent creates a `.csv` file in the workspace folder with
  a summary of all grades. This extension can delete that file and file name can
  be configured.

* The rubric used to evaluate and grade the assignments is provided either in
  the grading agent or in a sepparate file referenced by the grading agent. The
  rubrics can even be in each student submission -e.g. students cloned or forked
  a repo with the rubric in it.

## Features

* The command **Grading Agent: Extract Students' Repositories** looks for files
  named `onlinetext.html` in subfolders and creates a `students_repos.json` file
  with the links to the repositories. A `.csv` and a `.txt` file with the same
  information are also created.

* The command **Grading Agent: Clone Students' Repositories** clones each
  repository in a `repo` folder in each subfolder. Links to the repositories are
  taken from the `students_repos.json` file.

* The command **Grading Agent: Delete Cloned Students' Repositories** deletes
  previously cloned repositories.

* The command **Grading Agent: Open Grading Agent** copies the selected file to
  the appropriate location to be used by the **Grading Agent: Grade Submission**
  command. See [Grading Agent Example](#grading-agent-example) below.

* The command **Grading Agent: Configure Chat Auto Approve** configures Visual
  Studio Code settings to auto-approve dotnet commands in the GitHub Copilot
  chat window.

* The command **Grading Agent: Grade Submission** opens the [Github Copilot chat
  window](https://code.visualstudio.com/docs/copilot/chat/getting-started-chat)
  and pastes a prompt to use the provided grading agent to grade the opened
  submission. The user should send the prompt to GitHub Copilot.

* The command **Grading Agent: Delete Grades** deletes grade files from the
  workspace and student folders. These files are generated from the grading
  agent, and file names can be configured. See [grading agent
  example](#grading-agent-example) and [configuration](#configuration) below.

* The command **Grading Agent: Enable Instructions and Agent** disables or
  enables `*instructions.md` files and grading agent file so they are ignored by
  GitHub Copilot. The command displays the list of avaible files and lets the
  user check or uncheck any of them. All files are initially enabled. This
  extensions disables files by renaming them.

## Requirements

This extension has been tested in Visual Studio Code version 1.108.

As mentioned above, the extension assumes the folder opened in Visual Studio
Code is an assignment exported from Moodle, but Moodle is not required.

A GitHub Copilot Pro subscription is required in order to run the grading agent.

## Grading Agent Example

A grading agent is just a Markdown file with instructions to grade an
assignment submission.

```text
---
name: 'Grading Agent'
description: 'This agent grades students assignments based on a rubric.'
tools: ["read", "search", "edit", "execute"]
---
# Instructions

You're a teaching assistant in a programming course.

Your task is to grade student assignments based on the rubric in the `README.md`
file in each student submission to evaluate and calculate points.

The assignment is in the folder where the currently opened file is located.

Explain the reasoning behind the score, including what's done well and what's
wrong or needs improvement in student's submission.

There should be a [grades.csv](../../grades.csv) file, if not, create one. In
that file, add a new line with the student's name and identifier, and the grade
assigned. Folder names and student's identifiers are
[here](../../students_repos.json)

In the assignment submission folder, create a GRADE.md file with an explanation
of the score.
```

In order for this grading agent example to work, there should be a `README.md`
in each subfolder, with the instructions for the assigment given to the students
and a rubric with the grading criteria. The grading agent can be easily adapted
to use a `.md` file with the rubric in the workspace folder opened in Visual
Studio Code. The rubric can be also included right in the grading agent file.

References to files used by the grading agent are included as markdown links.

In this example, all grades are collected in a `grades.csv` file in the
workspace folder opened in Visual Studio Code; it has the format that Moodle
uses to import grades, but the grading agent can be modified to export in any
format; just use natural langague to describe your format.

The feedback for each submission is generated in a `GRADE.md` file in each
subfolder; again, just use natural language to describe the structure of this
file if needed.

A [complete grading agent](/assets/grade.agent.md) is included in the repository.

## Configuration

You can customize the generated grade file names through Visual Studio Code
settings, to match the ones used in your grading agent:

**Workspace configuration**, in `.vscode/settings.json`:
```json
{
  "gradingagent.gradesFileName": "grades.csv",
  "gradingagent.studentGradeFileName": "GRADE.md"
}
```

**Global configuration**, in user settings:

Open Visual Studio Code settings and search for `gradingagent` to set:

* `gradingagent.gradesFileName`: Name of the grades file in workspace root

* `gradingagent.studentGradeFileName`: Name of the grade file in each student
  folder

## Known Issues

This extensions depends on the grading agent provided. The result are as good as
the grading agent is.

## Release Notes

### 0.0.1

Initial release of the extension.

**Enjoy!**

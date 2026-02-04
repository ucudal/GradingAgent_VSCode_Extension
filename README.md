# Grading Agent

This extension simplifies grading students' submissions using a [GitHub Copilot
Custom
Agent](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
in Visual Studio Code.

## Assumptions

This extension assumes:

* The folder currently opened in Visual Studio Code has been downloaded from
  [Moodle](https://moodle.org) and contains students' [assignment
  submissions](https://docs.moodle.org/501/en/Using_Assignment#Downloading_student_submissions).

* That folder has a subfolder for each student.

* Each subfolder has a file ending with the suffix `_assignsubmission_onlinetext`
  with a link to a remote repository with the student's solution to the assignment; or
  it has the actual files with the solution to the assignment.

* Teacher has created an `agent.md` file with the GitHub Copilot Custom Agent
  for grading students' submissions. This extension will copy the file in the
  appropriate location.

## Features

* The command **Grading Agent: Extract Students' Repositories** looks for files
  with the suffix `_assignsubmission_onlinetext` in subfolders and creates a
  `students_repos.json` file with the links to the repositories. A `.csv` and a
  `.txt` file with the same information are also created.

* The command **Grading Agent: Clone Students' Repositories** clones each
  repository in a `repo` folder in each subfolder. Links to the repositories are
  taken from the `students_repos.json` file.

* The command **Grading Agent: Delete Cloned Students' Repositories** deletes
  previously cloned repositories.

* The command **Grading Agent: Open Grading Agent** copies the selected file to
  the appropriate location. See [Grading Agent Example](#grading-agent-example)
  below.

* The command **Grading Agent: Grade Submission** opens the [Github Copilot chat
  window](https://code.visualstudio.com/docs/copilot/chat/getting-started-chat)
  and pastes a prompt to use the provided grading agent to grade the opened
  submission.

## Requirements

This extension has been tested in Visual Studio Code version 1.108.

As mentioned above, the extension assumes the folder opened in Visual Studio
Code is an assignment exported from Moodle, but Moodle is not required.

## Grading Agent Example

A grading agent is just a Markdown file with instructions to grade an
assignment submission.

Here's a complete grading agent:

```markdown
---
name: 'Grading Agent'
description: 'This agent grades students assignments based on a rubric.'
tools: ["read", "search", "edit", "execute"]
---

# Instructions

You're a teaching assistant in a programming course.

Your task is to grade student assignments based on the rubric in
[this file](../../README.md) to evaluate and calculate points.

The assignment is in the folder where the currently opened file is located.

Explain the reasoning behind the score, including what's done well and what's
wrong or needs improvement in student's submission.

In addition to the rubric:

* If the code doesn't compile, grade is always 0.

* If there are tests and they don't pass, grade is always 0.

* If there are compiler warnings, deduct 2 points total from the final
  grade.

* If there are logic errors, even if tests pass, deduct 2 points from the final
  grade, for each logic error found.

* Do not deduct points for issues not mentioned in the rubric or in these
  instructions.

There should be a [grades.csv](../../grades.csv) file, if not, create one. In
that file, add a new line with the student identifier and the grade assigned.
Folder names and student's identifiers are [here](../../students_repos.json)

In the assignment submission folder, create a GRADE.md file with an explanation
of the score. The language should be Spanish.
```

In order for this grading agent example to work, there should be a `README.md`
file in the folder opened in Visual Studio Code, or a `README.md` in each
subfolder, with the instructions for the assigment given to the students and a
rubric with the grading criteria.

References to files used by the grading agent are included as markdown links.

In this example all grades are collected in a `grades.csv` file in the folder
opened in Visual Studio Code; it has the format that Moodle uses to import
grades.

The feedback for each submission is generated in a `GRADE.md` file in each
subfolder.

## Known Issues

This extensions depends on the grading agent provided. The result are as good as
the grading agent is.

## Release Notes

### 0.0.1

Initial release of the extension.

**Enjoy!**

// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { analyze } from '@mdrs/language-server';

export type ProblemSeverity = 'error' | 'warning';

export interface EditorProblem {
    line: number;
    column: number;
    message: string;
    severity: ProblemSeverity;
}

export function editorProblems(text: string): EditorProblem[] {
    return analyze(text).diagnostics.map(diagnostic => ({
        line: diagnostic.range.start.line + 1,
        column: diagnostic.range.start.character + 1,
        message:
            typeof diagnostic.message === 'string' ? diagnostic.message : diagnostic.message.value,
        severity: diagnostic.severity === 1 ? 'error' : 'warning'
    }));
}

export function problemLines(problems: EditorProblem[]): Map<number, ProblemSeverity> {
    const lines = new Map<number, ProblemSeverity>();
    for (const problem of problems) {
        if (lines.get(problem.line) !== 'error') lines.set(problem.line, problem.severity);
    }
    return lines;
}

// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { MailingCommand } from '#lib/mailing.ts';

export interface SpotlightCommandContext {
    close: () => void;
    setHelp: (open: boolean) => void;
    openShare: () => void;
    openQr: () => void;
    requestMailing: (request: MailingCommand) => void;
}

import type { MailingCommand } from '#lib/mailing.ts';

export interface SpotlightCommandContext {
    close: () => void;
    setHelp: (open: boolean) => void;
    openShare: () => void;
    openQr: () => void;
    requestMailing: (request: MailingCommand) => void;
}

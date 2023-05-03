import { Ticket } from './ticket';

export type TicketCreationParameters = Pick<
  Ticket,
  'source' | 'firstName' | 'lastName' | 'phoneNumber' | 'email' | 'extra'
>;
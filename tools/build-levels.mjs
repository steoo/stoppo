// Source for js/levels.js: the 100 original Subway Shuffle levels, transcribed
// from reference/LevelNNN.jpg.
//
//   node tools/build-levels.mjs
//
// Each entry: [par, goal, stations, edges]
//   par       optimal move count from the image header ("Level N: 0 / par moves")
//   goal      letter of the ringed station
//   stations  letter: [px, py, car] in image pixels; car is '' (empty), a color
//             letter, or an uppercase letter for the train (the target car)
//   edges     "AB r" = track of color r between A and B; repeat a pair for
//             parallel tracks
// Colors: r red, b blue, g green, y yellow, p purple, o orange.
// The script checks every level with the BFS solver and fails on a par mismatch.

import { writeFileSync } from 'node:fs';
import { solve } from '../js/engine.js';

const OUT = new URL('../js/levels.js', import.meta.url);
const C = { r: 0, b: 1, g: 2, y: 3, p: 4, o: 5 };
const L = [
  [3, 'D', {A:[310,410,'R'],B:[550,410,'b'],C:[550,200,''],D:[790,410,'']}, 'AB r, BD r, BC b'],
  [10, 'E', {A:[250,224,''],B:[490,224,'R'],C:[730,224,'b'],D:[610,432,'g'],E:[850,432,'']}, 'AB r, BC b, BD r, CD g, CE g, DE r'],
  [12, 'E', {A:[310,432,'R'],B:[430,224,''],C:[550,432,'b'],D:[670,224,'g'],E:[790,432,'r']}, 'AB r, AC r, BC r, BD g, CD r, DE r, CE b'],
  [11, 'D', {A:[402,224,'b'],B:[644,224,''],C:[884,224,'R'],D:[282,432,'y'],E:[524,432,'b'],F:[764,432,'g']}, 'AB b, BC r, AD y, AE b, BE r, BF b, CF b, DE r, EF g'],
  [13, 'C', {A:[464,136,'g'],B:[704,136,'y'],C:[344,342,'g'],D:[584,342,'y'],E:[824,342,'g'],F:[464,552,'R'],G:[704,552,'']}, 'AB g, AC g, AD y, BD y, BE g, CF r, DF y, EG g, FG r'],
  [15, 'C', {A:[550,164,'y'],B:[342,286,''],C:[758,286,'b'],D:[550,406,'R'],E:[342,526,'g'],F:[758,526,'g']}, 'AB y, AC g, AD g, BD r, BE r, CD r, CF b, DE g, DF g'],
  [17, 'B', {A:[328,154,'b'],B:[568,154,'b'],C:[808,154,'b'],D:[448,362,'b'],E:[688,362,''],F:[328,570,'b'],G:[568,570,'g'],H:[808,570,'R']}, 'AB b, BC b, AD b, CE b, BE r, DF b, DG b, EH r, FG g, GH b'],
  [16, 'B', {A:[584,114,''],B:[344,344,'b'],C:[584,344,'y'],D:[824,344,'r'],E:[584,576,'R']}, 'AB r, AC r, AD r, BC y, CD y, CE r, BE b, DE b'],
  [19, 'C', {A:[310,242,''],B:[550,242,'r'],C:[790,242,'g'],D:[310,482,'b'],E:[550,482,'r'],F:[790,482,'R']}, 'AB r, BC r, AD b, BE r, CF g, DE r, EF r'],
  [16, 'E', {A:[430,136,'g'],B:[670,136,''],C:[310,344,'b'],D:[550,344,'R'],E:[790,344,'y'],F:[670,552,'b']}, 'AB g, AC b, AD b, BD b, BE b, CD r, DE r, DF b, EF y'],
  [17, 'F', {A:[550,118,'R'],B:[430,328,''],C:[670,328,'g'],D:[310,536,'b'],E:[550,536,'b'],F:[790,536,'r']}, 'AB r, AC g, BC b, BD r, BE r, CE b, CF b, DE b, EF r'],
  [19, 'G', {A:[190,120,''],B:[310,328,''],C:[550,328,''],D:[790,328,'g'],E:[430,536,'g'],F:[670,536,'R'],G:[910,536,'b']}, 'AB r, BC b, CD b, BE r, CE g, CF g, DF g, DG b, EF r, FG r'],
  [24, 'D', {A:[190,258,''],B:[430,258,'b'],C:[670,258,'b'],D:[910,258,'r'],E:[310,466,''],F:[550,466,'R'],G:[790,466,'b']}, 'AB b, BC b, CD b, AE r, BE r, CG b, DG r, EF r, FG r'],
  [23, 'D', {A:[448,136,''],B:[688,136,'R'],C:[328,344,'r'],D:[568,344,'r'],E:[808,344,'r'],F:[448,552,'g'],G:[688,552,'b']}, 'AB r, AC r, BE r, CF r, DE r, DF g, DG r, EG b, FG r'],
  [21, 'C', {A:[508,136,''],B:[748,136,'y'],C:[388,344,'g'],D:[628,344,'R'],E:[868,344,'b'],F:[268,552,'g'],G:[508,552,'b'],H:[748,552,'b']}, 'AB b, AC g, BD b, BE y, CF g, CG r, DE b, DG r, EH b, FG b, GH b'],
  [21, 'G', {A:[310,136,'b'],B:[550,136,'b'],C:[790,136,'R'],D:[190,344,''],E:[430,344,'g'],F:[670,344,'y'],G:[910,344,'g'],H:[310,552,'b'],I:[550,552,'b'],J:[790,552,'g']}, 'AB b, BC g, AD b, BE g, CF r, CG g, DH b, EF y, EI g, FJ r, GJ r, HI b, IJ g'],
  [26, 'G', {A:[328,114,''],B:[568,114,'g'],C:[808,114,'R'],D:[328,326,'b'],E:[808,326,'b'],F:[328,540,'b'],G:[568,540,'b'],H:[808,540,'b']}, 'AB b, BC r, AD b, BD r, BE g, CE b, DF b, DG r, EG b, EH g, FG b, GH b'],
  [24, 'C', {A:[568,134,'R'],B:[208,344,'b'],C:[448,344,'y'],D:[688,344,'g'],E:[928,344,''],F:[568,552,'y']}, 'AB b, AC r, AD y, AE r, BC y, CD g, DE y, BF r, CF y, DF y, EF r'],
  [30, 'D', {A:[404,224,'b'],B:[644,224,''],C:[884,224,'R'],D:[284,432,'r'],E:[524,432,'g'],F:[764,432,'']}, 'AB r, BC g, AD r, AE b, BE g, BF r, CF r, DE g, EF r'],
  [22, 'B', {A:[448,152,'y'],B:[688,152,'b'],C:[328,362,''],D:[568,362,'R'],E:[808,362,'p'],F:[448,570,'o'],G:[688,570,'g']}, 'AB y, AC b, AD g, BD r, BE b, CD b, DE b, CF o, DF r, DG g, EG p, FG r'],
  [22, 'A', {A:[404,154,'g'],B:[644,154,''],C:[524,362,'b'],D:[764,362,'y'],E:[404,570,''],F:[644,570,'R']}, 'AB r, AC g, AC y, BC g, BD r, CD y, CF b, DF r, EF r, EF b'],
  [27, 'F', {A:[524,118,'b'],B:[764,118,'y'],C:[404,326,'y'],D:[644,326,'R'],E:[884,326,'y'],F:[284,536,''],G:[524,536,'b'],H:[764,536,'b']}, 'AB y, AC y, AD b, BD r, BE y, CF y, CG b, DG r, DH b, EH b, FG r, GH b'],
  [28, 'D', {A:[404,224,'b'],B:[644,224,'r'],C:[884,224,''],D:[284,432,'g'],E:[524,432,'R'],F:[764,432,'r']}, 'AB r, BC r, AD g, AE b, BE r, BF r, CF r, DE r, EF b'],
  [28, 'F', {A:[448,118,'b'],B:[688,118,'g'],C:[328,326,'b'],D:[568,326,'b'],E:[808,326,''],F:[448,536,'r'],G:[688,536,'R']}, 'AB g, AC b, AD b, BD b, BE b, CD r, DE r, CF r, CF b, EG r, EG b, FG r'],
  [29, 'G', {A:[208,224,''],B:[448,224,'b'],C:[688,224,'y'],D:[928,224,'g'],E:[328,432,''],F:[568,432,'R'],G:[808,432,'r']}, 'AB r, BC b, CD g, AE r, BE b, BF r, CF g, CG y, DG r, EF g, FG r'],
  [29, 'E', {A:[268,136,'b'],B:[508,136,'g'],C:[748,136,'b'],D:[388,344,'b'],E:[628,344,''],F:[868,344,'R'],G:[508,552,'b'],H:[748,552,'y']}, 'AB g, BC r, AD b, BD r, BE y, CE b, CF r, DE r, DG b, EG b, EH y, FH b, GH b'],
  [37, 'F', {A:[550,136,''],B:[790,136,'g'],C:[190,344,'R'],D:[430,344,'b'],E:[670,344,'r'],F:[910,344,''],G:[310,552,'y'],H:[550,552,'g']}, 'AD r, BE g, BF g, CD r, DE r, EF r, CG y, DG b, EH g, GH y'],
  [24, 'A', {A:[224,258,'y'],B:[464,258,'b'],C:[704,258,''],D:[944,258,''],E:[344,466,'y'],F:[584,466,'R'],G:[824,466,'g']}, 'AB r, BC y, CD r, AE y, BE b, BF r, CF r, CG y, DG g, EF y, FG y'],
  [41, 'C', {A:[370,154,'y'],B:[610,154,'g'],C:[850,154,'r'],D:[250,362,''],E:[490,362,''],F:[730,362,'b'],G:[610,570,'R']}, 'AB r, BC r, AD r, AE y, BF g, CF b, DE r, EF r, EG r, FG b'],
  [34, 'A', {A:[448,154,''],B:[688,154,'g'],C:[328,362,'g'],D:[568,362,'b'],E:[808,362,'r'],F:[448,570,'r'],G:[688,570,'R']}, 'AB g, AC g, AD r, BE r, CF r, DE b, DF b, DG r, EG r, FG r'],
  [34, 'C', {A:[508,136,'g'],B:[748,136,'g'],C:[388,344,''],D:[628,344,'y'],E:[868,344,'p'],F:[268,552,'b'],G:[508,552,'g'],H:[748,552,'R']}, 'AB g, AC y, AD y, BD g, BE p, CF b, CG r, DE g, DG g, DH y, EH g, FG g, GH r'],
  [38, 'A', {A:[448,154,''],B:[688,154,'y'],C:[328,362,'g'],D:[568,362,'r'],E:[808,362,'R'],F:[448,570,'b'],G:[688,570,'r']}, 'AB y, AC r, BE r, CD g, DE r, CF r, DF r, DG r, EG r, FG b'],
  [24, 'D', {A:[190,258,''],B:[430,258,''],C:[670,258,'g'],D:[910,258,'b'],E:[310,466,'R'],F:[550,466,'b'],G:[790,466,'b']}, 'AB b, BC b, CD r, AE b, BE r, BF r, CF r, CG g, DG b, EF b, FG b'],
  [36, 'B', {A:[388,154,'o'],B:[628,154,'b'],C:[868,154,''],D:[268,362,'b'],E:[508,362,'y'],F:[748,362,'b'],G:[388,570,'R'],H:[628,570,'b'],I:[868,570,'g']}, 'AB y, BC b, AD o, AE y, BE b, BF r, CF b, DE b, DG b, EH b, FH r, FI g, GH r, HI b'],
  [43, 'D', {A:[404,136,'y'],B:[644,136,'g'],C:[884,136,'g'],D:[284,344,''],E:[524,344,''],F:[764,344,'b'],G:[644,552,'R'],H:[884,552,'g']}, 'AB g, BC g, AD g, AE y, BE r, BF r, CF r, CH g, DE r, EG g, FG r, FH b, GH g'],
  [37, 'B', {A:[490,154,'g'],B:[730,154,'b'],C:[370,362,'r'],D:[610,362,''],E:[490,570,'r'],F:[730,570,'R']}, 'AB r, AC r, AE r, AD g, BD b, CD b, CE r, DE g, DF b, EF r'],
  [40, 'D', {A:[344,136,'g'],B:[584,136,''],C:[824,136,'R'],D:[224,344,'g'],E:[464,344,'b'],F:[704,344,'b'],G:[944,344,'o'],H:[344,552,'g'],I:[584,552,'b'],J:[824,552,'y']}, 'AB g, BC r, AD g, BE r, CG b, DE r, DH g, EH b, EI y, FG o, FI b, FJ b, GJ b, HI b, IJ y'],
  [46, 'G', {A:[328,120,''],B:[208,328,'g'],C:[448,328,''],D:[688,328,'y'],E:[928,328,'b'],F:[328,536,'R'],G:[568,536,'r'],H:[808,536,'r']}, 'AB r, AC r, BC g, CD r, DE b, BF r, CF b, CG b, DG b, DH y, EH r, FG r, GH r'],
  [39, 'F', {A:[310,136,''],B:[790,136,'y'],C:[190,344,'R'],D:[430,344,'g'],E:[670,344,'b'],F:[910,344,'g'],G:[310,552,'y'],H:[790,552,'g']}, 'AB b, AC r, AD r, AG y, BE b, BF y, CG g, DE r, DG g, EF r, EG y, EH g, FH g, GH g'],
  [43, 'C', {A:[584,136,''],B:[824,136,'b'],C:[224,344,'b'],D:[464,344,'y'],E:[704,344,'g'],F:[944,344,''],G:[344,552,'b'],H:[584,552,'b'],I:[824,552,'R']}, 'AB b, AD b, BF b, CD r, CG b, DG y, DH r, EF g, EH r, EI r, FI b, GH b, HI b'],
  [32, 'D', {A:[388,136,''],B:[628,136,'y'],C:[268,344,'y'],D:[508,344,'b'],E:[748,344,'r'],F:[388,552,'b'],G:[628,552,'g'],H:[868,552,'R']}, 'AB y, AC y, BD b, BE b, CD r, DE r, CF r, DF b, DG g, EH b, FG r, GH r'],
  [39, 'B', {A:[328,154,''],B:[568,154,'b'],C:[808,154,'r'],D:[208,362,'r'],E:[448,362,'b'],F:[688,362,'b'],G:[928,362,'b'],H:[328,570,'R'],I:[568,570,'b']}, 'AB r, BC b, AD r, AE b, BE b, BF r, CF r, CG b, DE r, FG b, DH b, EH r, FI b, HI b'],
  [36, 'D', {A:[508,136,''],B:[748,136,'y'],C:[388,344,'R'],D:[628,344,'g'],E:[868,344,'b'],F:[268,552,'b'],G:[508,552,'b'],H:[748,552,'b']}, 'AB b, AC r, AD b, BD g, BE y, CD b, DE b, CF b, CG r, DG r, DH g, EH y, FG b, GH b'],
  [40, 'D', {A:[670,136,'g'],B:[310,344,''],C:[550,344,'R'],D:[790,344,'b'],E:[670,552,'r']}, 'AB b, AC r, AC g, AD b, AE b, BC r, BC g, BE b, BE g, CE r, DE r, DE g'],
  [41, 'G', {A:[568,118,'b'],B:[208,328,''],C:[448,328,'R'],D:[688,328,'b'],E:[928,328,'b'],F:[328,536,'b'],G:[568,536,'g'],H:[808,536,'']}, 'AB b, AC r, AE r, BC b, CD r, DE b, BF g, CF b, DF b, DG r, EG b, EH r, FG g'],
  [59, 'D', {A:[190,258,''],B:[430,258,'R'],C:[670,258,'g'],D:[910,258,'b'],E:[310,466,''],F:[550,466,'r'],G:[790,466,'r']}, 'AE r, BC r, CD b, BE r, BF r, CF b, CG g, DG r, EF b, FG r'],
  [55, 'C', {A:[328,154,'r'],B:[568,154,'r'],C:[808,154,''],D:[208,362,'r'],E:[448,362,'b'],F:[688,362,'r'],G:[928,362,'r'],H:[328,570,'R'],I:[568,570,'b'],J:[808,570,'r']}, 'AB r, BC r, AD r, BE b, BF b, CF r, DE r, FG r, EH r, EI b, FI b, GJ r, HI r, IJ r'],
  [54, 'A', {A:[328,154,''],B:[568,154,''],C:[808,154,'y'],D:[208,362,'g'],E:[448,362,'b'],F:[688,362,'g'],G:[928,362,'R'],H:[328,570,'b'],I:[568,570,'g'],J:[808,570,'y']}, 'AB g, BC g, AD r, AE b, CF g, CG y, DE g, FG r, DH r, EH b, EI g, FI g, FJ r, GJ y, HI r, IJ r'],
  [58, 'C', {A:[344,136,'p'],B:[584,136,'g'],C:[224,344,'g'],D:[464,344,'R'],E:[704,344,''],F:[944,344,'g'],G:[344,552,'b'],H:[584,552,'y'],I:[824,552,'g']}, 'AB g, AC g, AD p, BD r, BE g, CD r, DE r, EF r, CG b, DG g, DH g, EH g, EI g, FI g, GH y, HI y'],
  [63, 'A', {A:[224,258,'r'],B:[464,258,'b'],C:[704,258,'R'],D:[944,258,''],E:[344,466,'g'],F:[584,466,'y'],G:[824,466,'']}, 'AB r, AB b, BC b, CD b, AE y, BE g, BF r, CF r, DG r, EF y, FG r, FG y'],
  [48, 'A', {A:[284,154,'r'],B:[524,154,'g'],C:[404,362,'y'],D:[644,362,''],E:[884,362,'R'],F:[524,570,''],G:[764,570,'b']}, 'AB r, AC y, BC g, BD r, CD y, DE y, CF r, DF r, DG r, EG r, FG b'],
  [48, 'B', {A:[566,114,'g'],B:[358,230,'b'],C:[774,230,'g'],D:[150,344,'y'],E:[566,344,''],F:[982,344,'g'],G:[358,460,'y'],H:[774,460,'R'],I:[566,576,'y']}, 'AB g, AC g, AE y, BD b, BE r, BG g, CE y, CF g, DG y, EG y, EH r, EI y, FH r, GI g, HI g'],
  [52, 'E', {A:[328,136,'R'],B:[568,136,'b'],C:[808,136,'g'],D:[208,344,'y'],E:[448,344,'b'],F:[688,344,'b'],G:[928,344,'g'],H:[328,552,'b'],I:[568,552,''],J:[808,552,'b']}, 'AB r, BC b, AD b, AE b, BE b, BF r, CF b, CG g, DE y, DH b, EI r, FI r, FJ b, GJ g, HI b, IJ b'],
  [53, 'C', {A:[310,148,'R'],B:[550,148,'g'],C:[790,148,''],D:[310,362,'r'],E:[550,362,'b'],F:[790,362,'r'],G:[310,576,'y'],H:[550,576,'r'],I:[790,576,'p']}, 'AB g, BC g, AD r, BE b, CF r, DE r, EF r, DG y, EH r, FI p, GH r, HI r'],
  [49, 'J', {A:[328,120,''],B:[568,120,'y'],C:[808,120,'g'],D:[208,328,''],E:[448,328,'p'],F:[688,328,'b'],G:[928,328,'g'],H:[328,536,''],I:[568,536,'R'],J:[808,536,'o']}, 'AD g, BC g, BE g, BF y, CF b, CG g, DE g, FG r, DH r, EH p, FI r, FJ b, GJ r, HI r, IJ o'],
  [44, 'G', {A:[344,114,'g'],B:[584,114,'g'],C:[824,114,'R'],D:[344,326,'y'],E:[584,326,'b'],F:[824,326,'b'],G:[344,540,''],H:[584,540,'b']}, 'AB g, BC r, AD y, BD r, BE b, BF g, CF b, DE g, EF g, DG r, EG g, EH b, FH b, GH b'],
  [60, 'D', {A:[344,136,''],B:[584,136,'b'],C:[824,136,''],D:[224,344,'y'],E:[464,344,'g'],F:[704,344,'b'],G:[944,344,'b'],H:[344,552,'y'],I:[584,552,'R'],J:[824,552,'o']}, 'AD b, AE b, BE b, BF b, CF y, CG b, DE r, EF y, FG b, DH y, EH g, EI r, FI y, FJ o, GJ r, HI y, IJ r'],
  [48, 'A', {A:[328,154,'y'],B:[568,154,''],C:[208,362,'R'],D:[448,362,'g'],E:[688,362,'g'],F:[928,362,'y'],G:[328,570,'b'],H:[568,570,'g'],I:[808,570,'g']}, 'AB y, AC g, AD r, BD g, BE y, CD g, EF y, CG r, DG r, DH g, EH g, EI g, FI g, GH b, HI b'],
  [57, 'B', {A:[268,154,'b'],B:[508,154,'b'],C:[748,154,'b'],D:[388,362,'g'],E:[628,362,'b'],F:[868,362,''],G:[268,570,'R'],H:[508,570,'g'],I:[748,570,'y']}, 'AB g, BC b, AD b, BD g, BE r, CE b, CF r, DE b, EF r, DG b, DH g, EH r, EI b, FI y, GH r, HI b'],
  [37, 'E', {A:[490,136,'R'],B:[730,136,''],C:[370,344,'b'],D:[610,344,'g'],E:[850,344,'g'],F:[250,552,'b'],G:[490,552,'y'],H:[730,552,'g']}, 'AB r, AC g, AD r, BD g, BE g, CD b, DE r, CF b, CG g, DG g, DH b, EH b, FG y, GH g'],
  [55, 'A', {A:[508,154,'b'],B:[748,154,''],C:[388,362,'b'],D:[628,362,'r'],E:[868,362,'b'],F:[268,570,'R'],G:[508,570,'b'],H:[748,570,'b']}, 'AB r, AC b, AD b, BD r, BE b, CD r, DE b, CF b, CG b, DG r, DH r, EH r, FG r, GH b'],
  [58, 'C', {A:[310,154,''],B:[550,154,'r'],C:[790,154,'y'],D:[430,362,'b'],E:[670,362,'R'],F:[310,570,'g'],G:[550,570,'b'],H:[790,570,'']}, 'AB r, BC r, AF r, AD b, DG b, BD g, DF g, BE g, CE y, EG r, EH y, FG r, GH r'],
  [51, 'I', {A:[328,118,'y'],B:[568,118,'R'],C:[208,326,'y'],D:[448,326,'y'],E:[688,326,'y'],F:[928,326,'b'],G:[328,536,'g'],H:[568,536,'g'],I:[808,536,'']}, 'AB r, AC y, BD g, BE r, CD y, DE y, EF y, CG y, DG g, DH g, EH g, EI r, FI b, GH y, HI y'],
  [51, 'C', {A:[464,136,'y'],B:[704,136,'b'],C:[344,344,''],D:[584,344,'y'],E:[824,344,'b'],F:[464,552,'R'],G:[704,552,'g']}, 'AB r, AC y, AD y, AE y, AF r, BC b, BD b, BG r, CD r, DE r, CF b, CG y, DF g, EF b, EG r, FG g'],
  [51, 'B', {A:[328,154,'g'],B:[568,154,'b'],C:[808,154,'g'],D:[208,362,'y'],E:[448,362,'o'],F:[688,362,'R'],G:[928,362,''],H:[328,570,''],I:[568,570,'b'],J:[808,570,'o']}, 'AB g, BC g, AD g, AE b, BE r, BF b, CF r, CG g, DE y, EF o, FG b, DH g, EH r, EI b, FI r, FJ o, GJ b, HI r, IJ b'],
  [62, 'J', {A:[328,118,'R'],B:[568,118,''],C:[808,118,'g'],D:[208,326,'g'],E:[448,326,'b'],F:[688,326,'g'],G:[928,326,'b'],H:[328,536,'g'],I:[568,536,'y'],J:[808,536,'b']}, 'AB g, BC g, AD r, AE b, BE g, BF g, CF r, CG r, DE r, EF r, FG b, DH g, EH g, EI b, FI b, FJ r, GJ b, HI y, IJ y'],
  [68, 'A', {A:[448,154,''],B:[688,154,'g'],C:[328,362,'b'],D:[568,362,'r'],E:[808,362,'R'],F:[448,570,'b'],G:[688,570,'r']}, 'AB g, AC r, BE r, CD b, DE b, CF r, CF b, DF r, DG r, EG r, EG b, FG r'],
  [70, 'B', {A:[328,154,''],B:[568,154,'b'],C:[808,154,'r'],D:[208,362,''],E:[448,362,''],F:[688,362,'g'],G:[928,362,'r'],H:[328,570,''],I:[568,570,''],J:[808,570,'R']}, 'AB r, BC b, AD r, BE b, BF g, CF r, CG r, DE r, EF r, FI r, HI r, GJ r'],
  [69, 'A', {A:[566,148,''],B:[358,254,'y'],C:[774,254,'b'],D:[150,362,'r'],E:[566,362,'g'],F:[982,362,'r'],G:[358,468,'r'],H:[774,468,'r'],I:[566,576,'R']}, 'AB r, AC r, AE g, BD r, BE y, BG b, CE b, CF r, CH y, DG r, EG b, EH y, FH r, GI r, HI r'],
  [62, 'G', {A:[310,136,''],B:[550,136,''],C:[790,136,'b'],D:[190,344,'y'],E:[430,344,'g'],F:[670,344,'p'],G:[910,344,'o'],H:[310,552,'R'],I:[550,552,'b'],J:[790,552,'b']}, 'AB b, AD y, AE b, BE y, BF b, CF b, CG o, DE y, FG r, DH r, EH g, EI b, FI r, FJ p, GJ b, HI r, IJ b'],
  [63, 'D', {A:[190,154,'b'],B:[430,154,'y'],C:[670,154,'p'],D:[910,154,''],E:[310,362,'b'],F:[550,362,'R'],G:[790,362,'r'],H:[430,570,'g'],I:[670,570,'b']}, 'AB y, BC r, CD p, AE b, BE r, BF r, CG b, DG r, EF b, FG r, EH g, FI b, GI b, HI b'],
  [60, 'B', {A:[448,154,'R'],B:[688,154,'r'],C:[328,362,'b'],D:[568,362,'r'],E:[808,362,'y'],F:[448,570,'g'],G:[688,570,'']}, 'AB r, AC b, AF r, BC g, BE y, CD r, DE r, CF g, DF r, EF g, EG y, FG r'],
  [65, 'C', {A:[566,114,'b'],B:[358,230,'o'],C:[774,230,'b'],D:[150,344,''],E:[566,344,'g'],F:[982,344,'p'],G:[358,460,'y'],H:[774,460,'R'],I:[566,576,'b']}, 'AB o, AC b, AE y, BD o, BE b, BG y, CE b, CF p, CH r, DG b, EG y, EH g, EI b, FH g, GI b, HI r'],
  [67, 'A', {A:[328,154,'y'],B:[568,154,'b'],C:[808,154,'b'],D:[208,362,'y'],E:[448,362,'g'],F:[688,362,'R'],G:[928,362,'b'],H:[328,570,''],I:[568,570,'o'],J:[808,570,'b']}, 'AB b, BC b, AD y, AE r, BE g, CF b, DE b, EF r, FG r, DH y, EI b, FI b, FJ b, GJ b, HI o, IJ o'],
  [66, 'D', {A:[566,114,'b'],B:[150,298,'b'],C:[982,298,'b'],D:[344,390,''],E:[566,298,'b'],F:[774,390,'b'],G:[566,482,'R'],H:[358,576,'r'],I:[774,576,'b']}, 'AB r, AC b, AD b, AF r, BD b, BH r, DE r, DH b, EF b, EG r, FG b, FI r, CI r, GH r, GI b, HI b'],
  [65, 'E', {A:[448,136,'g'],B:[688,136,'g'],C:[328,344,'y'],D:[568,344,'R'],E:[808,344,'b'],F:[208,552,'g'],G:[448,552,'y'],H:[688,552,''],I:[928,552,'b']}, 'AB b, AC b, AD g, BD g, BE b, CD r, DE r, CF r, CG y, DG g, DH g, EH y, EI b, FG g, GH y, HI g'],
  [70, 'G', {A:[310,136,''],B:[550,136,''],C:[790,136,'y'],D:[190,344,'b'],E:[430,344,'g'],F:[670,344,'b'],G:[910,344,'b'],H:[310,552,'g'],I:[550,552,'b'],J:[790,552,'R']}, 'AB r, BC b, AD r, AE g, BE b, BF r, CF y, CG b, DE r, FG r, DH b, EH g, EI r, FI b, FJ b, GJ b, HI b, IJ r'],
  [71, 'C', {A:[328,258,'r'],B:[568,258,'b'],C:[808,258,''],D:[208,466,'r'],E:[448,466,'b'],F:[688,466,'R'],G:[928,466,'g']}, 'AB b, BC r, AD r, AE r, BE r, BE b, BF b, CG g, DE r, DE b, EF r, FG r'],
  [73, 'E', {A:[328,136,'R'],B:[568,136,'b'],C:[808,136,'b'],D:[208,344,''],E:[448,344,'g'],F:[688,344,'y'],G:[928,344,'b'],H:[328,552,'b'],I:[568,552,''],J:[808,552,'b']}, 'AB r, BC r, AD b, AE b, BE b, CE b, CF r, CG b, DE g, FG y, DH b, EH r, FH b, FI b, FJ r, GJ b, HI r, IJ r'],
  [74, 'C', {A:[404,136,'R'],B:[644,136,'y'],C:[284,344,'g'],D:[524,344,'r'],E:[764,344,'r'],F:[404,552,''],G:[644,552,'b'],H:[884,552,'y']}, 'AB r, AC g, BD y, BE r, CD r, DE y, CF y, DF y, DG r, EG r, EH y, FG b, GH r'],
  [85, 'G', {A:[310,136,'b'],B:[550,136,'b'],C:[790,136,'b'],D:[190,344,'b'],E:[430,344,'R'],F:[670,344,'g'],G:[910,344,'b'],H:[310,552,'y'],I:[550,552,''],J:[790,552,'y']}, 'AB b, BC b, AD b, AE b, BE r, BF r, CF g, CG b, FG r, DH b, EI b, FI b, FJ b, GJ y, HI y, IJ y'],
  [74, 'G', {A:[310,136,'R'],B:[550,136,''],C:[790,136,'b'],D:[190,344,'y'],E:[430,344,'y'],F:[670,344,'b'],G:[910,344,'b'],H:[310,552,'g'],I:[550,552,'g'],J:[790,552,'b']}, 'AB r, BC r, AD y, AE b, BE b, BF r, CF b, CG b, DE y, EF y, FG r, DH g, EH b, EI b, FI b, FJ b, GJ g, HI g, IJ g'],
  [119, 'H', {A:[328,118,''],B:[568,118,'r'],C:[808,118,'r'],D:[208,326,'b'],E:[448,326,'r'],F:[688,326,'R'],G:[928,326,'r'],H:[328,536,'r'],I:[568,536,'r'],J:[808,536,'r']}, 'AB r, BC r, AD r, CG r, DE b, EF b, FG b, DH r, DH b, EH r, EI r, FI r, FJ r, GJ r, GJ b, HI b, IJ b'],
  [75, 'G', {A:[268,118,''],B:[508,118,'R'],C:[748,118,'b'],D:[388,326,'y'],E:[628,326,'g'],F:[868,326,'r'],G:[508,536,'b'],H:[748,536,'r']}, 'AB r, BC r, AD y, BE g, CE r, CF b, DE r, EF r, DG r, EG g, EH r, FH r, GH b'],
  [81, 'E', {A:[328,136,'R'],B:[568,136,'r'],C:[808,136,'b'],D:[448,344,'b'],E:[688,344,'r'],F:[328,552,'b'],G:[568,552,'r'],H:[808,552,'']}, 'AB r, BC b, AD b, BD r, BE b, CE r, DE b, DF b, DG r, EG b, EH r, FG r, GH r'],
  [90, 'G', {A:[310,136,''],B:[550,136,'b'],C:[790,136,'g'],D:[190,344,'R'],E:[430,344,'b'],F:[670,344,'r'],G:[910,344,'y'],H:[310,552,''],I:[550,552,'r']}, 'AD r, BC y, BE y, BF b, CF g, CG y, DE y, EF r, FG r, DH r, EH r, EI b, FI b, HI r'],
  [100, 'G', {A:[310,136,'r'],B:[550,136,'y'],C:[790,136,'R'],D:[190,344,'r'],E:[430,344,'r'],F:[670,344,'o'],G:[910,344,''],H:[310,552,'g'],I:[550,552,'b'],J:[790,552,'']}, 'AB r, BC y, AD r, AE r, BF r, CF r, CG y, DH b, EH g, EI r, FJ o, GJ r, HI b, IJ r'],
  [92, 'G', {A:[310,136,'b'],B:[550,136,'b'],C:[790,136,'y'],D:[190,344,'o'],E:[430,344,'R'],F:[670,344,'p'],G:[910,344,''],H:[310,552,'b'],I:[550,552,'b'],J:[790,552,'g']}, 'AB b, BC y, AD o, AE b, CE b, CF b, CG y, DE r, FG b, DH r, EH b, EI r, FI p, GI r, GJ g, HI b, IJ b'],
  [93, 'G', {A:[310,136,'b'],B:[550,136,'b'],C:[790,136,'g'],D:[190,344,''],E:[430,344,'y'],F:[670,344,'R'],G:[910,344,'r'],H:[310,552,''],I:[550,552,'g']}, 'AB b, BC b, AD b, AE r, BE r, BF r, CF g, CG b, DE y, FG r, DH b, EH r, FI g, HI r'],
  [75, 'A', {A:[224,148,'g'],B:[464,148,'R'],C:[704,148,''],D:[944,148,'b'],E:[224,360,'b'],F:[944,360,'b'],G:[224,576,'g'],H:[464,576,'g'],I:[704,576,'b'],J:[944,576,'b']}, 'AB r, AB g, BC r, BC g, CD r, AE b, BE g, CF g, DF b, EG b, EH g, FI b, FJ g, GH b, GH g, HI b, IJ b'],
  [75, 'A', {A:[566,148,''],B:[398,290,'b'],C:[738,290,'b'],D:[228,432,'R'],E:[566,432,'g'],F:[906,432,'g'],G:[398,576,'b'],H:[738,576,'y']}, 'AB b, AC g, AE r, BC r, BD r, BE y, BG b, CE g, CF b, CH r, DE r, DG b, EF g, EG g, EH y, FH b, GH b'],
  [99, 'B', {A:[328,154,'R'],B:[568,154,'y'],C:[808,154,'y'],D:[208,362,'y'],E:[448,362,'b'],F:[688,362,'g'],G:[928,362,'y'],H:[328,570,'g'],I:[568,570,'b'],J:[808,570,'']}, 'AB y, BC y, AD r, AE y, BE r, BE g, BF g, CF b, CG b, DE r, EF y, FG g, DH y, EH g, EI b, FI b, FJ y, GJ y, HI y, IJ y'],
  [107, 'J', {A:[328,118,'b'],B:[568,118,''],C:[808,118,'o'],D:[208,326,'b'],E:[448,326,'R'],F:[688,326,'g'],G:[928,326,'o'],H:[328,536,'b'],I:[568,536,'b'],J:[808,536,'y']}, 'AB o, BC o, AD o, AE b, BE b, BF b, CF b, CG o, DE b, EF r, FG b, DH b, EH r, EI b, FI g, FJ r, GJ y, IJ b'],
  [110, 'D', {A:[344,136,'g'],B:[584,136,'R'],C:[824,136,'r'],D:[224,344,''],E:[464,344,'y'],F:[704,344,'b'],G:[944,344,''],H:[344,552,'y'],I:[584,552,'b'],J:[824,552,'r']}, 'AB r, BC r, AE g, BE y, CF r, CG r, DE g, EF r, FG b, DH r, EH y, FI b, GJ r, HI r, IJ r'],
  [75, 'E', {A:[328,136,'r'],B:[568,136,'b'],C:[808,136,'y'],D:[208,344,'g'],E:[448,344,'r'],F:[688,344,'r'],G:[928,344,'R'],H:[328,552,'r'],I:[568,552,''],J:[808,552,'r']}, 'AB r, BC r, AD g, AE r, BE b, BF b, CF r, CG y, DE r, FG r, DH r, EI b, FI b, GJ r, HI r, IJ r'],
  [118, 'F', {A:[208,114,'b'],B:[448,114,'R'],C:[688,114,'g'],D:[928,114,'g'],E:[208,344,'b'],F:[448,344,'y'],G:[688,344,''],H:[928,344,'g'],I:[208,576,'b'],J:[448,576,'b'],K:[688,576,'b'],L:[928,576,'g']}, 'AB r, BC r, CD g, AE g, AF b, BF y, BG y, CG r, DG b, DH g, EF b, FG r, GH b, EI g, EJ g, FJ b, FK b, GK b, GL b, HL g, IJ b, JK g, KL g'],
  [136, 'D', {A:[344,136,'b'],B:[584,136,'g'],C:[824,136,'g'],D:[224,344,'r'],E:[464,344,'o'],F:[704,344,''],G:[944,344,'b'],H:[344,552,'y'],I:[584,552,'R'],J:[824,552,'b']}, 'AB g, BC g, AD g, AE b, BE b, BF b, CF r, CG r, DE r, EF r, FG b, DH y, EH o, EI r, FI b, FJ b, GJ r, HI y, IJ r'],
  [185, 'D', {A:[344,136,'r'],B:[584,136,''],C:[824,136,'g'],D:[224,344,'y'],E:[464,344,'o'],F:[704,344,'r'],G:[944,344,'r'],H:[344,552,'g'],I:[584,552,'R'],J:[824,552,'b']}, 'AB r, BC r, AD r, AE o, BF r, CF b, CG g, EF r, FG r, DH y, EH r, EI r, FJ b, GJ g, HI g, IJ g'],
  [329, 'C', {A:[328,154,'b'],B:[568,154,'r'],C:[808,154,''],D:[208,362,'b'],E:[448,362,'r'],F:[688,362,'g'],G:[928,362,'y'],H:[328,570,'R'],I:[568,570,'r'],J:[808,570,'r']}, 'AB r, BC r, AD b, AE r, BE y, BF y, CF g, CG r, DE b, EF b, FG y, DH r, EH r, EI b, FI r, FJ r, GJ b, HI r, IJ b'],
  [589, 'G', {A:[310,136,'r'],B:[550,136,'r'],C:[790,136,'b'],D:[190,344,''],E:[430,344,'r'],F:[670,344,'r'],G:[910,344,'y'],H:[310,552,'g'],I:[550,552,'R'],J:[790,552,'y']}, 'AB r, BC r, AD g, AE g, BE r, BE y, BF y, CF b, CG r, DE y, FG y, DH r, DH g, EH g, EI r, EI g, FI r, FJ r, GJ y, HI r, IJ g'],
];
const out = []; let ok = true;
L.forEach(([par, goal, st, edgeStr], i) => {
  const keys = Object.keys(st);
  const idx = Object.fromEntries(keys.map((k, n) => [k, n]));
  const nodes = keys.map((k) => [+(st[k][0] / 240).toFixed(2), +(st[k][1] / 240).toFixed(2)]);
  const edges = edgeStr.split(',').map((s) => s.trim().split(' ')).map(([ab, c]) => [idx[ab[0]], idx[ab[1]], C[c]]);
  const cars = []; let target;
  for (const k of keys) {
    const c = st[k][2]; if (!c) continue;
    if (c === c.toUpperCase()) { target = cars.length; }
    cars.push([idx[k], C[c.toLowerCase()]]);
  }
  // Put the target car first for readability.
  const tcar = cars.splice(target, 1)[0]; cars.unshift(tcar);
  const level = { name: `Level ${i + 1}`, par, nodes, edges, cars, target: { car: 0, node: idx[goal] } };
  const got = solve(level).moves?.length;
  console.log(`Level ${i + 1}: par ${par}, solver ${got}${got === par ? '' : '  <-- MISMATCH'}`);
  if (got !== par) ok = false;
  out.push('  ' + JSON.stringify(level));
});
writeFileSync(OUT,
`// Hand-transcribed from the original Subway Shuffle levels (reference/LevelNNN.jpg).
// Node coordinates are image pixels / 240. Par is the move count in each image's header,
// checked against the BFS solver. See js/engine.js for the format.
export const LEVELS = [
${out.join(',\n')},
];
`);
console.log(ok ? 'All levels match par.' : 'Some levels do not match par.');
if (!ok) process.exit(1);

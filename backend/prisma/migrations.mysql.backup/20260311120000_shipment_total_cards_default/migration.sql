-- AlterTable: totalCards nije obavezno pri kreiranju isporuke; default 0, popunjava se pri Excel importu
ALTER TABLE `shipments` MODIFY COLUMN `total_cards` INTEGER NOT NULL DEFAULT 0;

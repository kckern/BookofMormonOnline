import type { Label } from '../domain/label.js';
import type { LabelsRepository } from '../data/labelsRepository.js';

export class LabelsService {
  constructor(private readonly labels: LabelsRepository) {}

  list(): Promise<Label[]> {
    return this.labels.list();
  }
}

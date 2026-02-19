/** Types for Europrotocol (Form №155 RSA) */

export interface EuroParticipant {
  // Owner
  ownerFullName: string;
  ownerAddress: string;
  ownerPhone: string;
  ownerEmail: string;
  // Driver (if different from owner)
  driverFullName: string;
  driverBirthDate: string;
  driverAddress: string;
  driverLicenseNumber: string;
  driverLicenseCategory: string;
  driverLicenseExpiry: string;
  // Vehicle
  vehicleBrand: string;
  vehicleModel: string;
  vehicleVin: string;
  vehiclePlate: string;
  vehicleYear: string;
  vehicleColor: string;
  // Insurance
  insuranceCompany: string;
  policyNumber: string;
  policySeries: string;
  policyStartDate: string;
  policyEndDate: string;
  // Damage
  damageDescription: string;
  damagePoints: number[]; // indices 1-24 on the vehicle diagram
  remarks: string;
  // Circumstances (checkbox indices)
  circumstances: number[];
  // STS
  stsNumber: string;
  // Back side fields (per participant)
  driverIsOwner: boolean; // п.16: true = собственник, false = иное лицо
  canMove: boolean; // п.17: может ли ТС передвигаться своим ходом
  vehicleLocation: string; // п.17: где находится ТС (если не может)
  backRemarks: string; // п.18: примечания участника, разногласия
}

export interface EuroprotocolData {
  // Accident info
  accidentDate: string;
  accidentTime: string;
  accidentLocation: string;
  injuredPersons: boolean;
  otherDamage: string;
  witnesses: string;
  // Participants
  participantA: EuroParticipant;
  participantB: EuroParticipant;
  // Sketch description
  sketchDescription: string;
  // Photos
  photos: string[]; // URLs from storage
}

export const emptyParticipant = (): EuroParticipant => ({
  ownerFullName: '',
  ownerAddress: '',
  ownerPhone: '',
  ownerEmail: '',
  driverFullName: '',
  driverBirthDate: '',
  driverAddress: '',
  driverLicenseNumber: '',
  driverLicenseCategory: '',
  driverLicenseExpiry: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleVin: '',
  vehiclePlate: '',
  vehicleYear: '',
  vehicleColor: '',
  insuranceCompany: '',
  policyNumber: '',
  policySeries: '',
  policyStartDate: '',
  policyEndDate: '',
  damageDescription: '',
  damagePoints: [],
  remarks: '',
  circumstances: [],
  stsNumber: '',
  driverIsOwner: true,
  canMove: true,
  vehicleLocation: '',
  backRemarks: '',
});

export const emptyEuroprotocolData = (): EuroprotocolData => ({
  accidentDate: new Date().toISOString().slice(0, 10),
  accidentTime: new Date().toTimeString().slice(0, 5),
  accidentLocation: '',
  injuredPersons: false,
  otherDamage: '',
  witnesses: '',
  participantA: emptyParticipant(),
  participantB: emptyParticipant(),
  sketchDescription: '',
  photos: [],
});

/** Official circumstances list from Form 155 RSA */
export const CIRCUMSTANCES_LIST: string[] = [
  'ТС находилось на стоянке, парковке, обочине и т.п. в неподвижном состоянии',
  'Двигался на стоянке',
  'Выезжал со стоянки, с места парковки, остановки, со второстепенной дороги',
  'Заезжал на стоянку, парковку, во двор, на второстепенную дорогу',
  'Двигался прямо (не маневрировал)',
  'Двигался на перекрёстке',
  'Заезжал на перекрёсток с круговым движением',
  'Двигался по перекрёстку с круговым движением',
  'Столкнулся с ТС, двигавшимся в том же направлении по той же полосе',
  'Столкнулся с ТС, двигавшимся в том же направлении по другой полосе (в другом ряду)',
  'Менял полосу (перестраивался в другой ряд)',
  'Обгонял',
  'Поворачивал направо',
  'Поворачивал налево',
  'Совершал разворот',
  'Двигался задним ходом',
  'Выехал на сторону дороги, предназначенную для встречного движения',
  'Второе ТС находилось слева от меня',
  'Не выполнил требование знака приоритета',
  'Совершил наезд (на неподвижное ТС, препятствие, пешехода и т.п.)',
  'Остановился (стоял) на запрещающий сигнал светофора',
  'Иное',
];

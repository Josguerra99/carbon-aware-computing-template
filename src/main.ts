import { MathHelper } from "./core/mathHelper";
import { PredictionModel } from "./core/predictionModel";
import type { GhiSlot } from "./core/types";


class SimplePredictionModel extends PredictionModel {


  private height: number = 982;
  private endHour: number = 12;
  private startHour: number = 5;



  /**
   * Entrena el modelo con los datos de entrenamiento.
   * Esta función es llamada una vez al inicio del programa.
   * @param trainingData - Los datos de entrenamiento.
   * @returns void
   */
  async train(trainingData: GhiSlot[]): Promise<void> {
    

    let previousUtcDay=0;
    let totalDays=0;
    let averageHeight=0;
    let averageStartHour=0;
    let averageEndHour=0;

    let maxHeightOfDay:number|null=null;

    const daysSet=new Set<number>();

    let previousGhiWm2: number = trainingData[0]?.ghiWm2 ?? 0;
    for(let i=0;i<trainingData.length;i++){
      let utcGlobalDay =Math.round( new Date(trainingData[i].time).getTime() / 1000 / 60 / 60 / 24);
      const hour=trainingData[i].time.getUTCHours();
      const currentGhiWm2=trainingData[i].ghiWm2;

      if(previousGhiWm2===0 && currentGhiWm2!==0){
        averageStartHour += hour;
      }

      if(previousGhiWm2!==0 && currentGhiWm2===0){
        averageEndHour += hour;
      }

      previousGhiWm2=currentGhiWm2;
 
      previousGhiWm2=currentGhiWm2;
      daysSet.add(utcGlobalDay);
      if(previousUtcDay!==utcGlobalDay){
        if(maxHeightOfDay!==null)averageHeight+=maxHeightOfDay;
        totalDays++;
        maxHeightOfDay=null;
        previousUtcDay=utcGlobalDay;
      }

      if(maxHeightOfDay===null || trainingData[i].ghiWm2>maxHeightOfDay){
        maxHeightOfDay=trainingData[i].ghiWm2;
      }
      

    }
    
    averageStartHour/=totalDays;
    averageEndHour/=totalDays;
    averageHeight/=totalDays;
    this.height=averageHeight;
    this.startHour=averageStartHour;
    this.endHour=averageEndHour;

    if (this.endHour < this.startHour) this.endHour += 24;

    this.forecast(new Date("2026-09-06T13:00:00Z"));

  }

  /**
   * Predice el GHI en un timestamp UTC.
   * @param timestamp - La fecha y hora UTC a predecir.
   * @returns El valor del GHI predicho.
   */
  async forecast(timestamp: Date): Promise<number> {
    
    const parabola = MathHelper.createParabola(this.height,this.startHour,this.endHour);
    let hour=timestamp.getUTCHours();
    if (hour < this.startHour) hour += 24;
    const kw= parabola(hour);
    return Math.max(0, kw);
  }
}

export const WorkshopModel = new SimplePredictionModel();

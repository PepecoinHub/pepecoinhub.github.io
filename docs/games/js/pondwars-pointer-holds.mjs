// Separate pointer owners prevent one finger's release clearing another hold.
export class PointerHolds {
  constructor(){this.owners=new Map();}
  press(key,id){if(!this.owners.has(key))this.owners.set(key,new Set());this.owners.get(key).add(id);}
  release(key,id){this.owners.get(key)?.delete(id);}
  active(key){return !!this.owners.get(key)?.size;}
  clear(){this.owners.clear();}
}
